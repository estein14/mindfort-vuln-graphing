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
        f.finding_id         AS finding_id,
        f.vuln_title         AS vuln_title,
        f.vuln_description   AS vuln_description,
        f.vuln_severity      AS vuln_severity,
        f.vuln_vector        AS vuln_vector,
        f.vuln_owasp_id      AS vuln_owasp_id,
        f.vuln_cwe_id        AS vuln_cwe_id,
        f.vuln_cve_id        AS vuln_cve_id,
        f.asset_type         AS asset_type,
        f.asset_url          AS asset_url,
        f.asset_path         AS asset_path,
        f.asset_service      AS asset_service,
        f.asset_cluster      AS asset_cluster,
        f.asset_repo         AS asset_repo,
        f.asset_registry     AS asset_registry,
        f.asset_image        AS asset_image,
        f.pkg_name           AS pkg_name,
        f.pkg_version        AS pkg_version,
        f.pkg_ecosystem      AS pkg_ecosystem,
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
		finding_id: record.get("finding_id"),
		vuln_title: record.get("vuln_title"),
		vuln_description: record.get("vuln_description"),
		vuln_severity: record.get("vuln_severity"),
		vuln_vector: record.get("vuln_vector"),
		vuln_owasp_id: record.get("vuln_owasp_id"),
		vuln_cwe_id: record.get("vuln_cwe_id"),
		vuln_cve_id: record.get("vuln_cve_id"),
		asset_type: record.get("asset_type"),
		asset_url: record.get("asset_url"),
		asset_path: record.get("asset_path"),
		asset_service: record.get("asset_service"),
		asset_cluster: record.get("asset_cluster"),
		asset_repo: record.get("asset_repo"),
		asset_registry: record.get("asset_registry"),
		asset_image: record.get("asset_image"),
		pkg_name: record.get("pkg_name"),
		pkg_version: record.get("pkg_version"),
		pkg_ecosystem: record.get("pkg_ecosystem"),
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
