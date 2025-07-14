import axios from "axios";
import { Finding } from "@/app/models/finding";

const LITELLM_URL = `${process.env.LITELLM_BASE_URL}/chat/completions`;
const LITELLM_KEY = process.env.LITELLM_API_KEY!;
const MODEL = "gpt-4.1";

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export const TOOLS = {
	chat_only: "chat_only",
	general_graph_search: "general_graph_search",
	specific_graph_search: "specific_graph_search",
	semantic_graph_search: "semantic_graph_search",
	// semantic_cosine_similarity: "semantic_cosine_similarity",
};

export const llmContext = `The graph contains only **Finding** nodes. Each Finding node includes these fields:
- finding_id
- vuln_cve_id, vuln_cwe_id, vuln_owasp_id, vuln_title, vuln_severity, vuln_description, vuln_vector
- asset_type, asset_url, asset_service, asset_cluster, asset_path, asset_repo, asset_image, asset_registry
- pkg_ecosystem, pkg_name, pkg_version
- scanner, scan_id, timestamp

Valid relationships between findings:
- COMMON_ROOT_CAUSE
- HAS_SEVERITY
- OCCURRED_TOGETHER
- OVERLAPPING_REMEDIATION
- RELATED_ASSET
- SEMANTICALLY_RELATED_VULN
- SHARED_ASSET
- SHARED_CWE
- SHARED_EXPLOIT_TECHNIQUE
- SHARED_PACKAGE`;

export async function getIntent(message: string) {
	const intentPrompt = `
You are an intent classification assistant for a graph of vulnerability findings.

${llmContext}

Your task is to classify the user's intent into **one of the following tools**:

TOOLS:
1. 'chat_only' – General discussion or vague questions (e.g., "what is a CVE?")
2. 'general_graph_search' – If the user asks general questions about the graph or relationships
2. 'specific_graph_search' – If the user refers to **known fields** like CVE ID, CWE ID, severity, package name, or asset URL
3. 'semantic_graph_search' – If the user asks about general vulnerability types (e.g., "AQL injection", "race condition") that are not matched by structured fields

### Examples:

User message: "What is CVE-2023-12345?"  
→ { "action": "specific_graph_search", "reason": "Recognized CVE ID" }

User message: "What is the most common vulnerability?"
→ { "action": "general_graph_search", "reason": "General question about the graph" }

User message: "Show me all SQL injection findings"  
→ { "action": "semantic_graph_search", "reason": "SQL injection likely in description or vector embedding" }

User message: "What is OWASP?"  
→ { "action": "chat_only", "reason": "General discussion, no query needed" }

Now classify this message:
"${message}"

Respond **strictly in JSON**: { "action": "tool_name", "reason": "brief explanation" }
`;

	const res = await axios.post(
		LITELLM_URL,
		{
			model: "o4-mini",
			messages: [{ role: "user", content: intentPrompt }],
		},
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);

	const intentResp = res.data.choices[0].message.content.trim();

	let intent = "chat_only";
	let reason = "Defaulted to chat";

	try {
		const parsed = JSON.parse(intentResp);
		if (parsed?.action) {
			intent = parsed.action;
			reason = parsed.reason;
		}
	} catch {
		console.warn(
			"Intent classification failed, defaulting to chat_only:",
			intentResp
		);
	}

	return { intent, reason };
}

export async function chatOnly(
	message: string,
	history: ChatMessage[],
	memoryContext: string,
	recallSection: string
) {
	const systemPrompt: ChatMessage = {
		role: "system",
		content: `
You are a security assistant with access to memory and past interactions between a user and the assistant. Respond as clearly and concisely as possible.
User Question: ${message}
Memory Context: ${memoryContext}
Past Interactions:
- ${recallSection}

Please respond with HTML content (not a full HTML document). Use appropriate HTML tags like <h1>, <br>, <h2>, <p>, <ul>, <li>, <strong>, <em>, etc. to format your response. Do not include <html>, <head>, or <body> tags.
`,
	};

	const recentHistory = history.slice(-10);
	const messagesPayload = [systemPrompt, ...recentHistory];

	const res = await axios.post(
		LITELLM_URL,
		{ model: "gemini-2.5-flash", messages: messagesPayload },
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);

	const assistantReply = res.data.choices[0].message.content.trim();

	return assistantReply;
}

export async function getGeneralGraphSearchCypher(message: string) {
	const cypherPrompt = `
You are an expert Cypher assistant for a Neo4j aura database of vulnerability findings.

${llmContext}

Based on the users message, please generate a simple Cypher query that will retrieve the Findings and/or Relationships and all the data that can then be analyzed.

User message: "${message}"

Respond in strict JSON without \`\`\`: { "cypher": "MATCH ... RETURN ..." }
`;

	const res = await axios.post(
		LITELLM_URL,
		{
			model: MODEL,
			messages: [{ role: "user", content: cypherPrompt }],
		},
		{
			headers: {
				Authorization: `Bearer ${LITELLM_KEY}`,
			},
		}
	);

	const cypherResp = res.data.choices[0].message.content.trim();

	let cypher = "";
	try {
		const parsed = JSON.parse(cypherResp);
		if (parsed?.cypher) {
			cypher = parsed.cypher;
		} else {
			console.warn("No 'cypher' key found in response:", cypherResp);
		}
	} catch {
		console.warn("Cypher JSON parse failed:", cypherResp);
	}

	return cypher;
}

export async function getSpecificGraphSearchCypher(message: string) {
	const cypherPrompt = `
You are an expert Cypher assistant for a Neo4j aura database of vulnerability findings.

${llmContext}

Based on the users message, please generate a simple Cypher query that will retrieve whole Findings and/or Relationships that can then be analyzed.

User message: "${message}"

Respond in strict JSON without \`\`\`: { "cypher": "MATCH ... RETURN ..." }
`;

	const res = await axios.post(
		LITELLM_URL,
		{
			model: MODEL,
			messages: [{ role: "user", content: cypherPrompt }],
		},
		{
			headers: {
				Authorization: `Bearer ${LITELLM_KEY}`,
			},
		}
	);

	const cypherResp = res.data.choices[0].message.content.trim();

	let cypher = "";
	try {
		const parsed = JSON.parse(cypherResp);
		if (parsed?.cypher) {
			cypher = parsed.cypher;
		} else {
			console.warn("No 'cypher' key found in response:", cypherResp);
		}
	} catch {
		console.warn("Cypher JSON parse failed:", cypherResp);
	}

	return cypher;
}

export async function getSemanticSearchCypher(message: string) {
	const cypherPrompt = `
You are an expert Cypher assistant for a Neo4j database of vulnerability findings.

${llmContext}

Your task is:
1. Convert the user message into a **simple, executable Cypher query**.
2. Only use **MATCH**, **WHERE**, **RETURN** clauses. Avoid procedures, APOC, or custom tools.
3. Do **not invent node types, relationships, or indexes**.
4. Always use the label \`:Finding\`.
5. Only return a **JSON object** in this format:  
{ "cypher": "MATCH ... RETURN ..." }

User message: "${message}"
`;

	const res = await axios.post(
		LITELLM_URL,
		{
			model: MODEL,
			messages: [{ role: "user", content: cypherPrompt }],
		},
		{
			headers: {
				Authorization: `Bearer ${LITELLM_KEY}`,
			},
		}
	);

	const cypherResp = res.data.choices[0].message.content.trim();

	let cypher = "";
	try {
		const parsed = JSON.parse(cypherResp);
		if (parsed?.cypher) {
			cypher = parsed.cypher;
		} else {
			console.warn("No 'cypher' key found in response:", cypherResp);
		}
	} catch {
		console.warn("Cypher JSON parse failed:", cypherResp);
	}

	return cypher;
}

export async function analyzeGraphContext(
	message: string,
	data: Finding[],
	history: ChatMessage[]
) {
	const systemPrompt: ChatMessage = {
		role: "system",
		content: `
		AS QUICKLY AS AND CONCISELY AS POSSIBLE,
        Your job is to analyze the graph data and provide a response to the user's question. Feel free to use the memory context and past interactions to help you answer the question.
        User Question: ${message}
 
        Graph Data Retrieved:
        ${JSON.stringify(data, null, 2)}
        Please respond with HTML content (not a full HTML document). Use appropriate HTML tags like <h1>, <br>, <h2>, <p>, <ul>, <li>, <strong>, <em>, etc. to format your response. Do not include <html>, <head>, or <body> tags.

        `,
	};

	const recentHistory = history.slice(-10);
	const messagesPayload = [systemPrompt, ...recentHistory];

	const res = await axios.post(
		LITELLM_URL,
		{ model: MODEL, messages: messagesPayload },
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);

	const assistantReply = res.data.choices[0].message.content.trim();

	return assistantReply;
}
