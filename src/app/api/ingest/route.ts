import { driver } from "@/lib/graph";
import findings from "@/data/findings_data.json";
import { Asset, FindingSchema } from "@/app/models/finding";
import { NextResponse } from "next/server";

function generateAssetId(asset: Asset, finding_id: string) {
	switch (asset.type) {
		case "api_endpoint":

		case "web_route":
			return `${asset.type}::${asset.url ?? "unknown-url"}`;

		case "source_file":
			return `${asset.type}::${asset.repo ?? "unknown-repo"}::${
				asset.path ?? "unknown-path"
			}`;

		case "container_image":
			const registryPart = asset.registry ? `${asset.registry}::` : "";
			return `${asset.type}::${registryPart}${
				asset.image ?? "unknown-image"
			}`;

		default:
			// fallback for unknown asset types
			return `unknown_asset::${finding_id}`;
	}
}

export async function POST() {
	const session = driver.session();

	try {
		for (const finding of findings) {
			const tx = session.beginTransaction();

			try {
				const {
					finding_id,
					scanner,
					scan_id,
					timestamp,
					vulnerability,
					asset,
					package: pkg,
				} = finding;

				// Create Base Nodes
				await tx.run(
					`
                    MERGE (f:Finding {finding_id: $finding_id})
                    SET
                    f.scanner = $scanner,
                    f.scan_id = $scan_id,
                    f.timestamp = datetime($timestamp)`,
					{
						finding_id,
						scanner,
						scan_id,
						timestamp,
					}
				);

				await tx.run(
					`
                    MATCH (f:Finding {finding_id: $finding_id})
                    MERGE (v:Vulnerability {cwe_id: $cwe_id, title: $vuln_title})
                    ON CREATE SET
                    v.owasp_id    = $owasp_id,
                    v.severity    = $severity,
                    v.description = $description,
                    v.vector      = $vector
                    v.cve_id      = $cve_id
                    MERGE (f)-[:HAS_VULNERABILITY]->(v)
                    `,
					{
						finding_id,
						cwe_id: vulnerability.cwe_id,
						vuln_title: vulnerability.title,
						owasp_id: vulnerability.owasp_id ?? null,
						severity: vulnerability.severity,
						description: vulnerability.description,
						vector: vulnerability.vector,
						cve_id: vulnerability.cve_id ?? "N/A",
					}
				);

				const assetId = generateAssetId(finding.asset, finding_id);

				await tx.run(
					`
                    MATCH (f:Finding {finding_id: $finding_id})
                    MERGE (a:Asset {id: $assetId})
                    ON CREATE SET
                    a.type = $type
                    ${asset.url ? ", a.url = $url" : ""}
                    ${asset.path ? ", a.path = $path" : ""}
                    ${asset.image ? ", a.image = $image" : ""}
                    ${asset.registry ? ", a.registry = $registry" : ""}
                    ${asset.repo ? ", a.repo = $repo" : ""}
                    ${asset.service ? ", a.service = $service" : ""}
                    ${asset.cluster ? ", a.cluster = $cluster" : ""}
                    MERGE (f)-[:AFFECTS]->(a)
                    `,
					{
						finding_id,
						assetId,
						type: asset.type,
						...(asset.url && { url: asset.url }),
						...(asset.path && { path: asset.path }),
						...(asset.image && { image: asset.image }),
						...(asset.registry && { registry: asset.registry }),
						...(asset.repo && { repo: asset.repo }),
						...(asset.service && { service: asset.service }),
						...(asset.cluster && { cluster: asset.cluster }),
					}
				);

				if (pkg) {
					await tx.run(
						`
                       MERGE (p:Package {name: $name, version: $version, ecosystem: $ecosystem})
                       ON CREATE SET p.created = timestamp()
                      `,
						{
							name: pkg.name,
							version: pkg.version,
							ecosystem: pkg.ecosystem,
						}
					);
					// Link Vulnerability -> Package
					await tx.run(
						`
                       MATCH (v:Vulnerability {cwe_id: $cwe_id, title: $vuln_title})
                       MATCH (p:Package {name: $name, version: $version})
                       MERGE (v)-[:RELATED_PACKAGE]->(p)
                      `,
						{
							cwe_id: vulnerability.cwe_id,
							vuln_title: vulnerability.title,
							name: pkg.name,
							version: pkg.version,
						}
					);
				}

				await tx.commit();
			} catch (error) {
				console.error(
					`Ingestion error for finding ${finding.finding_id}:`,
					error
				);
				await tx.rollback();
			}
		}

		return NextResponse.json({ status: "success" });
	} catch (err) {
		console.error("Ingestion error:", err);
		return NextResponse.json(
			{ error: "Failed to ingest findings" },
			{ status: 500 }
		);
	} finally {
		await session.close();
	}
}
