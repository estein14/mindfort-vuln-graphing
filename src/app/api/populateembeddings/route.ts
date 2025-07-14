import { embedText } from "@/lib/embed";
import { driver } from "@/lib/graph";
import { NextResponse } from "next/server";

async function populateEmbeddings() {
	const session = driver.session();

	try {
		// Grab all Finding nodes that do not have embeddings
		const result = await session.run(`
			MATCH (f:Finding)
			WHERE f.embedding IS NULL
			RETURN
				f.finding_id AS finding_id,
				f.vuln_title AS vuln_title,
				f.vuln_description AS vuln_description,
				f.vuln_severity AS vuln_severity,
				f.vuln_vector AS vuln_vector,
				f.vuln_cwe_id AS vuln_cwe_id,
				f.asset_type AS asset_type,
				f.asset_url AS asset_url,
				f.asset_service AS asset_service,
				f.timestamp AS timestamp,
				f.pkg_name AS pkg_name,
				f.pkg_version AS pkg_version,
				f.pkg_ecosystem AS pkg_ecosystem,
				f.asset_cluster AS asset_cluster,
				f.asset_path AS asset_path,
				f.asset_repo AS asset_repo,
				f.asset_image AS asset_image,
				f.asset_registry AS asset_registry
		`);

		const findings = result.records.map((r) => r.toObject());

		for (const row of findings) {
			const embeddingInput = `
Finding ID: ${row.finding_id}
Title: ${row.vuln_title}
Description: ${row.vuln_description}
CWE: ${row.vuln_cwe_id}
Severity: ${row.vuln_severity}
Vector: ${row.vuln_vector}
Asset Type: ${row.asset_type}
Asset URL: ${row.asset_url}
Service: ${row.asset_service}
Timestamp: ${row.timestamp}
Package Name: ${row.pkg_name}
Package Version: ${row.pkg_version}
Package Ecosystem: ${row.pkg_ecosystem}
Asset Cluster: ${row.asset_cluster}
Asset Path: ${row.asset_path}
Asset Repo: ${row.asset_repo}
Asset Image: ${row.asset_image}
Asset Registry: ${row.asset_registry}
			`.trim();

			try {
				const embedding = await embedText(embeddingInput);

				await session.run(
					`
					MATCH (f:Finding {finding_id: $finding_id})
					SET f.embedding = $embedding
					`,
					{
						finding_id: row.finding_id,
						embedding,
					}
				);

				console.log(`Embedded: ${row.finding_id}`);
			} catch (err) {
				console.error(`Embedding error for ${row.finding_id}`, err);
			}
		}

		return { status: "success", count: findings.length };
	} finally {
		await session.close();
	}
}

export async function POST() {
	try {
		// const result = await populateEmbeddings();
		// console.log(result);
		return NextResponse.json({ message: "Embeddings already populated" });
	} catch (err) {
		console.error("Embedding population error:", err);
		return NextResponse.json(
			{ error: "Failed to populate embeddings" },
			{ status: 500 }
		);
	}
}
