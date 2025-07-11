import { driver } from "@/lib/graph";
import findings from "@/data/findings_data.json";
import { NextResponse } from "next/server";

export async function POST() {
	const session = driver.session();

	try {
		const severityLevels = ["CRITICAL", "HIGH", "MEDIUM"];
		const severityTx = session.beginTransaction();
		try {
			await severityTx.run(
				`UNWIND $levels AS lvl
				MERGE (:Severity {level: lvl})`,
				{ levels: severityLevels }
			);
			await severityTx.commit();
		} catch (error) {
			console.error("Error creating Severity nodes:", error);
			await severityTx.rollback();
		}

		for (const finding of findings) {
			const tx = session.beginTransaction();

			try {
				const asset = finding.asset ?? null;
				const vulnerability = finding.vulnerability ?? null;
				const pkg = finding.package ?? null;

				const { finding_id, scanner, scan_id, timestamp } = finding;

				const vulnOwasp = vulnerability.owasp_id ?? null;
				const vulnCwe = vulnerability.cwe_id;
				const vulnCve = vulnerability.cve_id ?? null;
				const vulnTitle = vulnerability.title ?? null;
				const vulnSev = vulnerability.severity ?? null;
				const vulnDesc = vulnerability.description ?? null;
				const vulnVec = vulnerability.vector ?? null;

				const assetType = asset.type;
				const assetUrl = asset.url ?? null;
				const assetSvc = asset.service ?? null;
				const assetCluster = asset.cluster ?? null;
				const assetPath = asset.path ?? null;
				const assetRepo = asset.repo ?? null;
				const assetImage = asset.image ?? null;
				const assetReg = asset.registry ?? null;

				const pkgEco = pkg?.ecosystem ?? null;
				const pkgName = pkg?.name ?? null;
				const pkgVer = pkg?.version ?? null;

				await tx.run(
					`
					MERGE (f:Finding {finding_id: $finding_id})
					SET
					  f.scanner         = $scanner,
					  f.scan_id         = $scan_id,
					  f.timestamp       = datetime($timestamp),
			
					  // Vulnerability fields
					  f.vuln_owasp_id   = $vulnOwasp,
					  f.vuln_cwe_id     = $vulnCwe,
					  f.vuln_cve_id     = $vulnCve,
					  f.vuln_title      = $vulnTitle,
					  f.vuln_severity   = $vulnSev,
					  f.vuln_description= $vulnDesc,
					  f.vuln_vector     = $vulnVec,
			
					  // Asset fields
					  f.asset_type      = $assetType,
					  f.asset_url       = $assetUrl,
					  f.asset_service   = $assetSvc,
					  f.asset_cluster   = $assetCluster,
					  f.asset_path      = $assetPath,
					  f.asset_repo      = $assetRepo,
					  f.asset_image     = $assetImage,
					  f.asset_registry  = $assetReg,
			
					  // Package fields
					  f.pkg_ecosystem   = $pkgEco,
					  f.pkg_name        = $pkgName,
					  f.pkg_version     = $pkgVer
					`,
					{
						finding_id,
						scanner,
						scan_id,
						timestamp,
						vulnOwasp,
						vulnCwe,
						vulnCve,
						vulnTitle,
						vulnSev,
						vulnDesc,
						vulnVec,
						assetType,
						assetUrl,
						assetSvc,
						assetCluster,
						assetPath,
						assetRepo,
						assetImage,
						assetReg,
						pkgEco,
						pkgName,
						pkgVer,
					}
				);

				await tx.run(
					`
					MATCH (f:Finding {finding_id: $finding_id})
					MERGE (s:Severity {level: $vulnSev})
					MERGE (f)-[:HAS_SEVERITY]->(s)
					`,
					{
						finding_id,
						vulnSev,
					}
				);

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
