import { embedText } from "@/lib/embed";
import { driver } from "@/lib/graph";
import { NextRequest, NextResponse } from "next/server";

export async function POST() {
	const session = driver.session();

	try {
		// Grab all Finding nodes that do not have embeddings
		const result = await session.run(`
			MATCH (f:Finding)
			WHERE f.embedding IS NULL
			RETURN
				f.finding_id AS id,
				f.vuln_title AS title,
				f.vuln_description AS description,
				f.vuln_severity AS severity,
				f.vuln_vector AS vector,
				f.vuln_cwe AS cwe,
				f.asset_type AS assetType,
				f.asset_url AS assetUrl,
				f.asset_service AS assetService,
				f.timestamp AS timestamp
		`);

		const findings = result.records.map((r) => r.toObject());

		for (const row of findings) {
			// Build a rich context for the embedding
			const embeddingInput = `
Finding ID: ${row.id}
Title: ${row.title}
Description: ${row.description}
CWE: ${row.cwe}
Severity: ${row.severity}
Vector: ${row.vector}
Asset Type: ${row.assetType}
Asset URL: ${row.assetUrl}
Service: ${row.assetService}
Timestamp: ${row.timestamp}
			`.trim();

			try {
				const embedding = await embedText(embeddingInput);

				await session.run(
					`
					MATCH (f:Finding {finding_id: $id})
					SET f.embedding = $embedding
					`,
					{
						id: row.id,
						embedding,
					}
				);

				console.log(`Embedded: ${row.id}`);
			} catch (err) {
				console.error(`Embedding error for ${row.id}`, err);
			}
		}

		return NextResponse.json({ status: "success", count: findings.length });
	} catch (e) {
		console.error("Embedding population error:", e);
		return NextResponse.json(
			{ error: "Failed to populate embeddings" },
			{ status: 500 }
		);
	} finally {
		await session.close();
	}
}
