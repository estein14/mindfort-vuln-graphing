import axios from "axios";
import { embedText } from "./embed";
import { addMemory, retrieveSimilarMemories } from "./vectorStore";
import { semanticSearch, cypherFromQuestion, runCypher } from "./graphTools";

const LITELLM_URL = `${process.env.LITELLM_BASE_URL}/chat/completions`;
const LITELLM_KEY = process.env.LITELLM_API_KEY!;
const MODEL = "gpt-4.1";

let memoryStore: string[] = [];

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

async function compressMemories(memories: string[]): Promise<string> {
	const prompt = `Summarize into one sentence:\n${memories.join("\n")}`;
	const res = await axios.post(
		LITELLM_URL,
		{ model: MODEL, messages: [{ role: "user", content: prompt }] },
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);
	return res.data.choices[0].message.content.trim();
}

async function createMemoryItem(
	question: string,
	answer: string
): Promise<string> {
	const prompt = `Summarize key interaction:\nQ: ${question}\nA: ${answer}`;
	const res = await axios.post(
		LITELLM_URL,
		{ model: MODEL, messages: [{ role: "user", content: prompt }] },
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);
	return res.data.choices[0].message.content.trim();
}

export async function runAgenticChat(
	history: ChatMessage[]
): Promise<{ answer: string; reasoning: string[] }> {
	const reasoning: string[] = [];
	const userMessage = history[history.length - 1].content;

	const intentPrompt = `Decide which of the following tools the assistant should use to best fulfill the request.
TOOLS:
1. \"chat_only\" - General discussion or high-level question. Use memory and chat.
2. \"semantic_search\" - Retrieve relevant findings by similarity to the query and analyze those.
3. \"cypher_analysis\" - Run one Cypher query to filter nodes and relationships, then another query to analyze them.

User message: \"${userMessage}\"
Respond in strict JSON: { \"action\": \"tool_name\", \"reason\": \"brief explanation\" }`;

	const intentResp = await axios.post(
		LITELLM_URL,
		{ model: MODEL, messages: [{ role: "user", content: intentPrompt }] },
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);

	console.log("Intent Response");
	console.log(intentResp.data.choices[0].message.content.trim());

	let intent = "chat_only";
	let reason = "Defaulted to chat";
	try {
		const parsed = JSON.parse(
			intentResp.data.choices[0].message.content.trim()
		);
		intent = parsed.action;
		reason = parsed.reason;
	} catch (e) {
		console.warn("Intent classification failed, defaulting to chat_only.");
	}

	reasoning.push(`Intent classified as '${intent}': ${reason}`);

	// Embed question, retrieve memories
	const userEmbedding = await embedText(userMessage);
	const similarMemories = retrieveSimilarMemories(userEmbedding, 3);
	reasoning.push(`Retrieved ${similarMemories.length} similar memories.`);

	// Compress memory if necessary
	if (memoryStore.length > 50) {
		const summary = await compressMemories(memoryStore);
		memoryStore = [summary];
		reasoning.push("Compressed long-term memory.");
	}
	const memoryContext = memoryStore.join("; ");
	const recallSection = similarMemories.join("\n- ");

	let graphContext: any[] = [];

	if (intent === "semantic_search") {
		graphContext = await semanticSearch(userMessage);
		reasoning.push(
			`Ran semantic search. Found ${graphContext.length} nodes.`
		);
	} else if (intent === "cypher_analysis") {
		const initialNodes = await semanticSearch(userMessage);
		const ids = initialNodes.map((n) => n.id);
		const cypherFollowupPrompt = `Given these node IDs: ${ids.join(
			", "
		)}, what Cypher query should I run to learn more about them and their relationships? Return only the query.`;
		const cypherRes = await axios.post(
			LITELLM_URL,
			{
				model: MODEL,
				messages: [{ role: "user", content: cypherFollowupPrompt }],
			},
			{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
		);
		const cypherQuery = cypherRes.data.choices[0].message.content.trim();
		graphContext = await runCypher(cypherQuery);
		reasoning.push(`Ran Cypher analysis query.`);
	}

	const systemPrompt: ChatMessage = {
		role: "system",
		content: `
You are a security assistant with access to a knowledge-graph and semantic memory. Respond as clearly and concisely as possible.
User Question: ${userMessage}
Memory Context: ${memoryContext}
Past Interactions:
- ${recallSection}
Graph Data Retrieved:
${JSON.stringify(graphContext, null, 2)}
		`,
	};

	const recentHistory = history.slice(-10);
	const messagesPayload = [systemPrompt, ...recentHistory];

	reasoning.push("Prepared final prompt for LLM.");

	const res = await axios.post(
		LITELLM_URL,
		{ model: MODEL, messages: messagesPayload },
		{ headers: { Authorization: `Bearer ${LITELLM_KEY}` } }
	);

	const assistantReply = res.data.choices[0].message.content.trim();

	const lastUser = history.findLast((m) => m.role === "user");
	if (lastUser) {
		const summary = await createMemoryItem(
			lastUser.content,
			assistantReply
		);
		memoryStore.push(summary);
		const embed = await embedText(summary);
		addMemory(embed, summary);
		reasoning.push("Stored summarized memory.");
	}

	console.log("Assistant Reply");
	console.log(reasoning);

	return { answer: assistantReply, reasoning };
}
