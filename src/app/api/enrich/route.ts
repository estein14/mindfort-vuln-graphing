import axios from "axios";
import { VulnerabilitySchema, Vulnerability } from "@/app/models/finding";
import { driver } from "@/lib/graph";
import { NextResponse } from "next/server";

const LITELLM_URL = `${process.env.LITELLM_BASE_URL}/chat/completions`;
const LITELLM_KEY = process.env.LITELLM_API_KEY!;
const MODEL = "gpt-4.1";

async function askAgent(prompt: string): Promise<string> {
	console.log("Asking agent");
	console.log(prompt);
	console.log(MODEL);
	console.log(LITELLM_URL);
	console.log(LITELLM_KEY);

	const response = await axios.post(
		LITELLM_URL,
		{ model: MODEL, messages: [{ role: "user", content: prompt }] },
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);
	return response.data.choices[0].message.content;
}
export async function fetchVulnerabilities(): Promise<Vulnerability[]> {
	const session = driver.session();
	const result = await session.run(`
      MATCH (v:Vulnerability)
      RETURN
        id(v)         AS id,
        v.cwe_id      AS cwe_id,
        v.owasp_id    AS owasp_id,
        v.cve_id      AS cve_id,
        v.title       AS title,
        v.description AS description,
        v.severity    AS severity,
        v.vector      AS vector,
        v.timestamp   AS timestamp
    `);
	await session.close();

	return result.records.map((record) => {
		const raw = {
			id: record.get("id").toString(),
			cwe_id: record.get("cwe_id"),
			owasp_id: record.get("owasp_id") ?? null,
			cve_id: record.get("cve_id") ?? null,
			title: record.get("title"),
			description: record.get("description"),
			severity: record.get("severity"),
			vector: record.get("vector"),
			timestamp: record.get("timestamp") ?? null,
		};

		return VulnerabilitySchema.parse(raw);
	});
}

interface InferredRel {
	from: string;
	to: string;
	type:
		| "SHARED_CWE"
		| "SHARED_VECTOR"
		| "SHARED_SCANNER"
		| "COMMON_ROOT_CAUSE"
		| "TEMPORAL_CLUSTER"
		| "SHARED_PACKAGE"
		| "SHARED_ASSET"
		| "DEPENDS_ON";
	explanation: string;
}

// 6. Build pairwise prompts and parse inferred relationships
async function inferRelationships(
	vulns: Vulnerability[]
): Promise<InferredRel[]> {
	const inferred: InferredRel[] = [];

	for (let i = 0; i < vulns.length; i++) {
		for (let j = i + 1; j < vulns.length; j++) {
			const A = vulns[i],
				B = vulns[j];

			const prompt = `
  You are a security analyst. Given two vulnerabilities, determine which of the following relationships apply:
  
  1) SHARED_CWE: share the same CWE or exploit technique.
  2) SHARED_VECTOR: share the same attack vector (e.g., network, code, config).
  3) SHARED_SCANNER: discovered by the same scanner or scan ID.
  4) SHARED_PACKAGE: affect the same software package or library.
  5) SHARED_ASSET: target the same asset or resource URL/path.
  6) COMMON_ROOT_CAUSE: arise from the same underlying misconfiguration or code pattern.
  7) TEMPORAL_CLUSTER: discovered within 24 hours of each other.
  8) DEPENDS_ON: one vulnerability likely leads to or enables the other (dependency lineage).
  
  Vuln A:
	ID = ${A.id}
	CWE = ${A.cwe_id}
	OWASP = ${A.owasp_id ?? "N/A"}
	Title = "${A.title}"
	Desc = "${A.description}"
	Severity = ${A.severity}
	Vector = ${A.vector}
  
  Vuln B:
	ID = ${B.id}
	CWE = ${B.cwe_id}
	OWASP = ${B.owasp_id ?? "N/A"}
	Title = "${B.title}"
	Desc = "${B.description}"
	Severity = ${B.severity}
	Vector = ${B.vector}
  
  Respond with a JSON array of objects, each with fields:
	from, to, type, explanation
  For example:
  [
	{"from":"${A.id}","to":"${
				B.id
			}","type":"SHARED_CWE","explanation":"Both share CWE-502"},
	...
  ]
  `;

			let reply = await askAgent(prompt);
			try {
				const relations: InferredRel[] = JSON.parse(reply);
				inferred.push(...relations);
			} catch (err) {
				console.warn(
					`Skipping bad AI reply for ${A.id}->${B.id}:`,
					reply
				);
			}
		}
	}
	return inferred;
}
async function writeRelationships(rels: InferredRel[]) {
	const session = driver.session();
	for (const { from, to, type, explanation } of rels) {
		await session.run(
			`
      MATCH (a),(b)
      WHERE id(a) = toInteger($from) AND id(b) = toInteger($to)
      MERGE (a)-[r:${type}]->(b)
      SET r.explanation = $explanation
      `,
			{ from, to, explanation }
		);
	}
	await session.close();
}

export async function runEnrichment() {
	console.log("Fetching vulnerabilities");
	const vulns = await fetchVulnerabilities();
	console.log(`Fetched ${vulns.length} vulnerabilities.`);

	console.log("Inferring relationships via AI");
	const inferred = await inferRelationships(vulns);
	console.log(`Inferred ${inferred.length} relationships.`);

	console.log("Writing relationships to Neo4j");
	await writeRelationships(inferred);

	await driver.close();
	console.log("Enrichment complete");
}

export async function POST() {
	try {
		await runEnrichment();
		return NextResponse.json(
			{ message: "Enrichment complete" },
			{ status: 200 }
		);
	} catch (error) {
		console.error("Enrichment error:", error);
		return NextResponse.json(
			{ error: "Failed to enrich" },
			{ status: 500 }
		);
	}
}
