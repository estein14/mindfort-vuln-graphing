import axios from "axios";
import { embedText } from "./embed";
import { driver } from "./graph";

export async function semanticSearch(query: string) {
	const queryEmbedding = await embedText(query);
	const session = driver.session();

	const result = await session.run(
		`
		MATCH (f:Finding)
        WHERE f.embedding IS NOT NULL
        WITH f, gds.similarity.cosine(f.embedding, $queryEmbedding) AS similarity
        RETURN
        f.finding_id         AS id,
        f.vuln_title         AS title,
        f.vuln_description   AS description,
        f.vuln_severity      AS severity,
        f.vuln_vector        AS vector,
        f.vuln_owasp_id      AS owasp_id,
        f.vuln_cwe_id        AS cwe,
        f.vuln_cve_id        AS cve,
        f.asset_type         AS asset_type,
        f.asset_url          AS asset_url,
        f.asset_path         AS asset_path,
        f.asset_service      AS asset_service,
        f.asset_cluster      AS asset_cluster,
        f.asset_repo         AS asset_repo,
        f.asset_registry     AS asset_registry,
        f.asset_image        AS asset_image,
        f.pkg_name           AS package_name,
        f.pkg_version        AS package_version,
        f.pkg_ecosystem      AS package_ecosystem,
        f.scanner            AS scanner,
        f.scan_id            AS scan_id,
        f.timestamp          AS timestamp,
        similarity
        ORDER BY similarity DESC
		`,
		{ queryEmbedding }
	);

	await session.close();

	return result.records.map((record) => ({
		id: record.get("id"),
		title: record.get("title"),
		description: record.get("description"),
		severity: record.get("severity"),
		vector: record.get("vector"),
		owasp_id: record.get("owasp_id"),
		cwe: record.get("cwe"),
		cve: record.get("cve"),
		asset_type: record.get("asset_type"),
		asset_url: record.get("asset_url"),
		asset_path: record.get("asset_path"),
		asset_service: record.get("asset_service"),
		asset_cluster: record.get("asset_cluster"),
		asset_repo: record.get("asset_repo"),
		asset_registry: record.get("asset_registry"),
		asset_image: record.get("asset_image"),
		package_name: record.get("package_name"),
		package_version: record.get("package_version"),
		package_ecosystem: record.get("package_ecosystem"),
		scanner: record.get("scanner"),
		scan_id: record.get("scan_id"),
		timestamp: record.get("timestamp"),
		similarity: record.get("similarity"),
	}));
}

export async function runCypher(cypher: string) {
	const session = driver.session();

	const cleanCypher = cypher.replace(/```(?:cypher)?/g, "").trim();

	const res = await session.run(cleanCypher);
	await session.close();

	return res.records.map((r) => r.toObject());
}

export async function cypherFromQuestion(question: string, context: string[]) {
	const prompt = `
Convert the following question into a Neo4j Cypher query. Nodes are "Finding" nodes with vulnerability, asset, and package properties:

Question: "${question}"
Context: ${context.join("\n- ")}

Respond with a single Cypher statement only.
`;

	const res = await axios.post(
		`${process.env.LITELLM_BASE_URL}/chat/completions`,
		{
			model: "gpt-4.1",
			messages: [{ role: "user", content: prompt }],
		},
		{ headers: { Authorization: `Bearer ${process.env.LITELLM_API_KEY}` } }
	);

	return res.data.choices[0].message.content.trim();
}
