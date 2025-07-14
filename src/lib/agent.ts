import axios from "axios";
import { embedText } from "./embed";
import { addMemory, retrieveSimilarMemories } from "./vectorStore";
import { runCypher, semanticSearch } from "./graphTools";
import {
	analyzeGraphContext,
	ChatMessage,
	chatOnly,
	getGeneralGraphSearchCypher,
	getIntent,
	getSemanticSearchCypher,
	getSpecificGraphSearchCypher,
	TOOLS,
} from "./agentTools";

const LITELLM_URL = `${process.env.LITELLM_BASE_URL}/chat/completions`;
const LITELLM_KEY = process.env.LITELLM_API_KEY!;
const MODEL = "gpt-4.1";

let memoryStore: string[] = [];

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

	// Find intent based on message
	const { intent, reason } = await getIntent(userMessage);
	reasoning.push(`Intent classified as '${intent}': ${reason}`);

	console.log("Intent", intent);
	console.log("Reason", reason);

	// Embed question, retrieve memories
	const userEmbedding = await embedText(userMessage);
	const similarMemories = retrieveSimilarMemories(userEmbedding, 5);
	reasoning.push(`Retrieved ${similarMemories.length} similar memories.`);

	// Compress memory if necessary
	if (memoryStore.length > 50) {
		const summary = await compressMemories(memoryStore);
		memoryStore = [summary];
		reasoning.push("Compressed long-term memory.");
	}

	const memoryContext = memoryStore.join("; ");
	const recallSection = similarMemories.join("\n- ");

	let assistantReply = "";

	if (intent === TOOLS.chat_only) {
		assistantReply = await chatOnly(
			userMessage,
			history,
			memoryContext,
			recallSection
		);

		console.log("Assistant Reply", assistantReply);
	} else if (intent === TOOLS.general_graph_search) {
		const cypher = await getGeneralGraphSearchCypher(userMessage);
		reasoning.push(`Generated Cypher query: ${cypher}`);

		console.log("Cypher", cypher);
		const cypherResult = await runCypher(cypher);

		assistantReply = await analyzeGraphContext(
			userMessage,
			cypherResult,
			memoryContext,
			recallSection,
			history
		);

		// assistantReply = await analyzeGraphContext(
	} else if (intent === TOOLS.specific_graph_search) {
		const cypher = await getSpecificGraphSearchCypher(userMessage);
		reasoning.push(`Generated Cypher query: ${cypher}`);

		console.log("Cypher", cypher);
		const cypherResult = await runCypher(cypher);

		assistantReply = await analyzeGraphContext(
			userMessage,
			cypherResult,
			memoryContext,
			recallSection,
			history
		);
	} else if (intent === TOOLS.semantic_graph_search) {
		const cypher = await getSemanticSearchCypher(userMessage);
		reasoning.push(`Generated Cypher query: ${cypher}`);

		console.log("Cypher", cypher);
		const cypherResult = await runCypher(cypher);

		assistantReply = await analyzeGraphContext(
			userMessage,
			cypherResult,
			memoryContext,
			recallSection,
			history
		);
	} else if (intent === TOOLS.semantic_cosine_similarity) {
		const semanticResponse = await semanticSearch(userMessage);
		assistantReply = await analyzeGraphContext(
			userMessage,
			semanticResponse,
			memoryContext,
			recallSection,
			history
		);
	} else {
		reasoning.push(`No tool found for intent: ${intent}`);
	}

	const lastUser = history.findLast((m) => m.role === "user");
	if (lastUser) {
		const summary = await createMemoryItem(
			lastUser.content,
			assistantReply
		);
		memoryStore.push(summary);
		const embed = await embedText(summary);
		addMemory(embed, summary);
	}

	console.log("Assistant Reply", assistantReply);
	console.log("Reasoning", reasoning);

	return { answer: assistantReply, reasoning };
}
