import axios from "axios";
import { driver } from "@/lib/graph";
import { NextResponse } from "next/server";
import {
	EnrichmentNode,
	EnrichmentResponse,
	EnrichmentNodeWithProperties,
	FindingProperties,
} from "@/app/models/finding";

const LITELLM_URL = `${process.env.LITELLM_BASE_URL}/chat/completions`;
const LITELLM_KEY = process.env.LITELLM_API_KEY!;
const MODEL = "gpt-4.1";

async function fetchGraphStats() {
	const session = driver.session();
	const result = await session.run(
		`
    MATCH (n:Finding)
    OPTIONAL MATCH (n)-[r]->(m)
    RETURN id(n) AS sourceId,
           labels(n) AS labels,
           properties(n) AS props,
           collect({ type: type(r), target: id(m) }) AS rels
    `
	);
	await session.close();

	// Transform to array of node objects
	return result.records.map((rec) => ({
		id: rec.get("sourceId").toString(),
		labels: rec.get("labels"),
		properties: rec.get("props"),
		relationships: (rec.get("rels") as { type: string; target: string }[])
			.filter((rel) => rel.type && rel.target !== null)
			.map((rel) => ({ type: rel.type, target: rel.target.toString() })),
	}));
}

const globalTools = {
	sharedCwe: async () => {
		const s = driver.session();
		await s.run(
			`
		MATCH (f1:Finding),(f2:Finding)
		WHERE f1.vuln_cwe_id = f2.vuln_cwe_id
		  AND f1.vuln_cwe_id IS NOT NULL
		  AND id(f1) < id(f2)
		MERGE (f1)-[:SHARED_CWE]->(f2)
		`
		);
		await s.close();
	},

	temporalCooccurrence: async () => {
		const s = driver.session();
		await s.run(
			`
			MATCH (f1:Finding), (f2:Finding)
			WHERE f1.timestamp IS NOT NULL AND f2.timestamp IS NOT NULL
				AND id(f1) < id(f2)
				AND abs(duration.between(f1.timestamp, f2.timestamp).seconds) < 3600
			WITH f1, f2, abs(duration.between(f1.timestamp, f2.timestamp).seconds) AS seconds_apart
			MERGE (f1)-[r:OCCURRED_TOGETHER]->(f2)
			SET r.seconds_apart = seconds_apart
			`
		);
		await s.close();
	},

	sharedPackage: async () => {
		const s = driver.session();
		await s.run(
			`
		MATCH (f1:Finding),(f2:Finding)
		WHERE f1.pkg_name = f2.pkg_name
		  AND f1.pkg_name IS NOT NULL
		  AND id(f1) < id(f2)
		MERGE (f1)-[:SHARED_PACKAGE]->(f2)
		`
		);
		await s.close();
	},

	sharedAsset: async () => {
		const s = driver.session();
		await s.run(
			`
		MATCH (f1:Finding),(f2:Finding)
		WHERE (f1.asset_service = f2.asset_service
			   OR f1.asset_url = f2.asset_url)
		  AND (f1.asset_service IS NOT NULL OR f1.asset_url IS NOT NULL)
		  AND id(f1) < id(f2)
		MERGE (f1)-[:SHARED_ASSET]->(f2)
		`
		);
		await s.close();
	},
};

const pairwiseTools = {
	semanticRootCause: async (
		a: EnrichmentNodeWithProperties,
		b: EnrichmentNodeWithProperties
	) => {
		console.log("Semantic Root Cause");
		console.log("a", a.properties.finding_id);
		console.log("b", b.properties.finding_id);
		const prompt = `Determine if findings '${a.properties.finding_id}' and '${b.properties.finding_id}' share a deeper root cause based on their vulnerability descriptions.
						Disregard any values that are null or empty.
						A='${a.properties.vuln_description}'
						B='${b.properties.vuln_description}'

						Respond in strict JSON: {"result":"yes"|"no","explanation":"..."}. If no, explanation is empty.`;

		const resp = await axios.post(
			LITELLM_URL,
			{ model: MODEL, messages: [{ role: "user", content: prompt }] },
			{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
		);

		let parsed;
		try {
			parsed = JSON.parse(resp.data.choices[0].message.content.trim());
		} catch {
			console.warn(
				"Malformed LLM output:",
				resp.data.choices[0].message.content
			);
			return;
		}

		if (/^yes/i.test(parsed.result)) {
			const s = driver.session();
			await s.run(
				`MATCH (f1:Finding {finding_id:$id1}), (f2:Finding {finding_id:$id2})
				MERGE (f1)-[r:COMMON_ROOT_CAUSE]->(f2)
				SET r.explanation = $explanation`,
				{
					id1: a.properties.finding_id,
					id2: b.properties.finding_id,
					explanation: parsed.explanation ?? "",
				}
			);
			await s.close();
		}
	},

	sharedExploitTechnique: async (
		a: EnrichmentNodeWithProperties,
		b: EnrichmentNodeWithProperties
	) => {
		console.log("Shared Exploit Technique");
		console.log("a", a.properties.finding_id);
		console.log("b", b.properties.finding_id);
		const prompt = `You are a security expert. Analyze the following findings and decide if they share a similar exploit technique, even if their CWE or OWASP IDs differ.
						
						A: CWE=${a.properties.vuln_cwe_id}, OWASP=${a.properties.vuln_owasp_id}, Title="${a.properties.vuln_title}", Desc="${a.properties.vuln_description}"
						B: CWE=${b.properties.vuln_cwe_id}, OWASP=${b.properties.vuln_owasp_id}, Title="${b.properties.vuln_title}", Desc="${b.properties.vuln_description}"

						Respond in strict JSON: {"result":"yes"|"no","explanation":"..."}. If no, explanation is empty.`;

		const resp = await axios.post(
			LITELLM_URL,
			{ model: MODEL, messages: [{ role: "user", content: prompt }] },
			{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
		);

		let parsed;
		try {
			parsed = JSON.parse(resp.data.choices[0].message.content.trim());
		} catch {
			console.warn(
				"Malformed LLM output:",
				resp.data.choices[0].message.content
			);
			return;
		}

		if (/^yes/i.test(parsed.result)) {
			const s = driver.session();
			await s.run(
				`MATCH (f1:Finding {finding_id:$id1}), (f2:Finding {finding_id:$id2})
				MERGE (f1)-[r:SHARED_EXPLOIT_TECHNIQUE]->(f2)
				SET r.explanation = $explanation`,
				{
					id1: a.properties.finding_id,
					id2: b.properties.finding_id,
					explanation: parsed.explanation ?? "",
				}
			);
			await s.close();
		}
	},

	relatedAsset: async (
		a: EnrichmentNodeWithProperties,
		b: EnrichmentNodeWithProperties
	) => {
		console.log("Related Asset");
		console.log("a", a.properties.finding_id);
		console.log("b", b.properties.finding_id);
		const prompt = `You are a security analyst. Determine if the following two assets are logically related or belong to the same functional area, even if the URLs or paths differ:
						Disregard any values that are null or empty.
						A: type=${a.properties.asset_type}, url=${a.properties.asset_url}, path=${a.properties.asset_path}, service=${a.properties.asset_service}, vector=${a.properties.vuln_vector}
						B: type=${b.properties.asset_type}, url=${b.properties.asset_url}, path=${b.properties.asset_path}, service=${b.properties.asset_service}
						Respond in strict JSON: {"result":"yes"|"no","explanation":"..."}. If no, explanation is empty.`;

		const resp = await axios.post(
			LITELLM_URL,
			{ model: MODEL, messages: [{ role: "user", content: prompt }] },
			{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
		);

		let parsed;
		try {
			parsed = JSON.parse(resp.data.choices[0].message.content.trim());
		} catch {
			console.warn(
				"Malformed LLM output:",
				resp.data.choices[0].message.content
			);
			return;
		}

		if (/^yes/i.test(parsed.result)) {
			const s = driver.session();
			await s.run(
				`MATCH (f1:Finding {finding_id:$id1}), (f2:Finding {finding_id:$id2})
				MERGE (f1)-[r:RELATED_ASSET]->(f2)
				SET r.explanation = $explanation`,
				{
					id1: a.properties.finding_id,
					id2: b.properties.finding_id,
					explanation: parsed.explanation ?? "",
				}
			);
			await s.close();
		}
	},

	semanticallyRelatedVuln: async (
		a: EnrichmentNodeWithProperties,
		b: EnrichmentNodeWithProperties
	) => {
		console.log("Semantically Related Vuln");
		console.log("a", a.properties.finding_id);
		console.log("b", b.properties.finding_id);
		const prompt = `Given the following two vulnerabilities, determine if their CWE or OWASP IDs, or their titles/descriptions, imply they are closely related or describe overlapping security issues (even if IDs differ).
						Disregard any values that are null or empty.
						A: CWE=${a.properties.vuln_cwe_id}, OWASP=${a.properties.vuln_owasp_id}, Title="${a.properties.vuln_title}", Desc="${a.properties.vuln_description}"
						B: CWE=${b.properties.vuln_cwe_id}, OWASP=${b.properties.vuln_owasp_id}, Title="${b.properties.vuln_title}", Desc="${b.properties.vuln_description}"

						Respond in strict JSON: {"result":"yes"|"no","explanation":"..."}. If no, explanation is empty.`;

		const resp = await axios.post(
			LITELLM_URL,
			{ model: MODEL, messages: [{ role: "user", content: prompt }] },
			{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
		);

		let parsed;
		try {
			parsed = JSON.parse(resp.data.choices[0].message.content.trim());
		} catch {
			console.warn(
				"Malformed LLM output:",
				resp.data.choices[0].message.content
			);
			return;
		}

		if (/^yes/i.test(parsed.result)) {
			const s = driver.session();
			await s.run(
				`MATCH (f1:Finding {finding_id:$id1}), (f2:Finding {finding_id:$id2})
				MERGE (f1)-[r:SEMANTICALLY_RELATED_VULN]->(f2)
				SET r.explanation = $explanation`,
				{
					id1: a.properties.finding_id,
					id2: b.properties.finding_id,
					explanation: parsed.explanation ?? "",
				}
			);
			await s.close();
		}
	},
	overlappingRemediation: async (
		a: EnrichmentNodeWithProperties,
		b: EnrichmentNodeWithProperties
	) => {
		console.log("Overlapping Remediation");
		console.log("a", a.properties.finding_id);
		console.log("b", b.properties.finding_id);
		const prompt = `
						You are a security engineer. Analyze whether a single remediation or fix could resolve BOTH of the following vulnerabilities. Consider all the details provided (title, description, CWE, OWASP, asset/service/path, package, etc). If yes, briefly explain what the remediation is.
						
						Finding A:
						- Finding ID: ${a.properties.finding_id}
						- CWE: ${a.properties.vuln_cwe_id}
						- OWASP: ${a.properties.vuln_owasp_id}
						- Title: ${a.properties.vuln_title}
						- Description: ${a.properties.vuln_description}
						- Asset: type=${a.properties.asset_type}, url=${a.properties.asset_url}, path=${a.properties.asset_path}, service=${a.properties.asset_service}
						- Package: name=${a.properties.pkg_name}, version=${a.properties.pkg_version}, ecosystem=${a.properties.pkg_ecosystem}
						
						Finding B:
						- Finding ID: ${b.properties.finding_id}
						- CWE: ${b.properties.vuln_cwe_id}
						- OWASP: ${b.properties.vuln_owasp_id}
						- Title: ${b.properties.vuln_title}
						- Description: ${b.properties.vuln_description}
						- Asset: type=${b.properties.asset_type}, url=${b.properties.asset_url}, path=${b.properties.asset_path}, service=${b.properties.asset_service}
						- Package: name=${b.properties.pkg_name}, version=${b.properties.pkg_version}, ecosystem=${b.properties.pkg_ecosystem}
						
						Respond in strict JSON: {"result":"yes"|"no","remediation":"..."}. If no, remediation is empty. Remediation is a single brief description.
					`;

		const resp = await axios.post(
			LITELLM_URL,
			{ model: MODEL, messages: [{ role: "user", content: prompt }] },
			{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
		);

		let parsed;
		try {
			parsed = JSON.parse(resp.data.choices[0].message.content.trim());
		} catch {
			console.warn(
				"Malformed LLM output:",
				resp.data.choices[0].message.content
			);
			return;
		}

		if (/^yes/i.test(parsed.result)) {
			const s = driver.session();
			await s.run(
				`
				MATCH (f1:Finding {finding_id:$id1}), (f2:Finding {finding_id:$id2})
				MERGE (f1)-[r:OVERLAPPING_REMEDIATION]->(f2)
				SET r.remediation = $remediation
				`,
				{
					id1: a.properties.finding_id,
					id2: b.properties.finding_id,
					remediation: parsed.remediation ?? "",
				}
			);
			await s.close();
		}
	},
};

async function runAgenticEnrichment() {
	for (const tool of Object.values(globalTools)) {
		await tool();
	}

	const nodes = await fetchGraphStats();

	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			await Promise.all([
				pairwiseTools.semanticRootCause(nodes[i], nodes[j]),
				pairwiseTools.sharedExploitTechnique(nodes[i], nodes[j]),
				pairwiseTools.relatedAsset(nodes[i], nodes[j]),
				pairwiseTools.semanticallyRelatedVuln(nodes[i], nodes[j]),
				pairwiseTools.overlappingRemediation(nodes[i], nodes[j]),
			]);
		}
	}

	await driver.close();
	console.log("Hybrid enrichment complete.");
}

export async function POST() {
	try {
		// await runAgenticEnrichment();
		return NextResponse.json(
			{ message: "Graph is already enriched :)" },
			{ status: 200 }
		);
	} catch (error: unknown) {
		console.error("Enrichment error:", error);
		return NextResponse.json(
			{ error: "Failed to enrich" },
			{ status: 500 }
		);
	}
}
