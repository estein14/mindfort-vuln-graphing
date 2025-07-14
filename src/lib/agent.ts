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
import { Finding } from "@/app/models/finding";

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
	const timing: Record<string, number> = {};
	const start = Date.now();
	const reasoning: string[] = [];
	const userMessage = history[history.length - 1].content;

	// Parallelize intent and embedding
	timing.intent_embed_start = Date.now();
	const [intentResult, userEmbedding] = await Promise.all([
		getIntent(userMessage),
		embedText(userMessage),
	]);
	timing.intent_embed_end = Date.now();
	const { intent, reason } = intentResult;
	reasoning.push(`Intent classified as '${intent}': ${reason}`);

	let assistantReply = "";
	let cypher: string | undefined;
	let cypherResult: unknown;

	// Helper for timing LLM/graph calls
	async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
		const t0 = Date.now();
		try {
			return await fn();
		} finally {
			const t1 = Date.now();
		}
	}

	if (intent === TOOLS.chat_only) {
		// Retrieve similar memories (can run in parallel with next step if needed)
		timing.memories_start = Date.now();
		const similarMemories = retrieveSimilarMemories(userEmbedding, 5);
		timing.memories_end = Date.now();
		reasoning.push(`Retrieved ${similarMemories.length} similar memories.`);

		const memoryContext = memoryStore.join("; ");
		const recallSection = similarMemories.join("\n- ");
		assistantReply = await timed("chatOnly", () =>
			chatOnly(userMessage, history, memoryContext, recallSection)
		);
	} else if (intent === TOOLS.general_graph_search) {
		cypher = await timed("getGeneralGraphSearchCypher", () =>
			getGeneralGraphSearchCypher(userMessage)
		);
		reasoning.push(`Generated Cypher query: ${cypher}`);
		cypherResult = await timed("runCypher", () => runCypher(cypher!));
		assistantReply = await timed("analyzeGraphContext", () =>
			analyzeGraphContext(userMessage, cypherResult as Finding[], history)
		);
		reasoning.push(`Analyzed the data.`);
	} else if (intent === TOOLS.specific_graph_search) {
		cypher = await timed("getSpecificGraphSearchCypher", () =>
			getSpecificGraphSearchCypher(userMessage)
		);
		reasoning.push(`Generated Cypher query: ${cypher}`);
		cypherResult = await timed("runCypher", () => runCypher(cypher!));
		assistantReply = await timed("analyzeGraphContext", () =>
			analyzeGraphContext(userMessage, cypherResult as Finding[], history)
		);
		reasoning.push(`Analyzed the data.`);
	} else if (intent === TOOLS.semantic_graph_search) {
		cypher = await timed("getSemanticSearchCypher", () =>
			getSemanticSearchCypher(userMessage)
		);
		reasoning.push(`Generated Cypher query: ${cypher}`);
		cypherResult = await timed("runCypher", () => runCypher(cypher!));
		assistantReply = await timed("analyzeGraphContext", () =>
			analyzeGraphContext(userMessage, cypherResult as Finding[], history)
		);
		reasoning.push(`Analyzed the data.`);
	}
	//  else if (intent === TOOLS.semantic_cosine_similarity) {
	// 	const semanticResponse = await timed("semanticSearch", () =>
	// 		semanticSearch(userMessage)
	// 	);
	// 	assistantReply = await timed("analyzeGraphContext", () =>
	// 		analyzeGraphContext(userMessage, semanticResponse, history)
	// 	);
	// }
	else {
		reasoning.push(`No tool found for intent: ${intent}`);
	}

	// Defer memory operations to run after response is returned
	setTimeout(async () => {
		// Compress memory if necessary
		if (memoryStore.length > 50) {
			const summary = await compressMemories(memoryStore);
			memoryStore = [summary];
			console.log("Compressed long-term memory.");
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
	}, 0);

	reasoning.push(`Total agent thought time: ${Date.now() - start} ms`);
	return { answer: assistantReply, reasoning };
}
