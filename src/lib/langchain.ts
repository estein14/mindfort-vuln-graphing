import { ChatOpenAI } from "@langchain/openai";
import { GraphCypherQAChain } from "langchain/chains/graph_qa/cypher";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";

export type ChatMessage = {
	role: "user" | "assistant" | "system";
	content: string;
};

let qaChain: GraphCypherQAChain | null = null;

// Attempt to use langChain which is a bit more robust than the agent.ts file
// but it's not working as expected.

export async function initQAChain(): Promise<GraphCypherQAChain> {
	if (qaChain) return qaChain;
	console.log("1");

	const llm = new ChatOpenAI({
		modelName: "gpt-4.1", // ✅ MUST be valid
		temperature: 0,
		openAIApiKey: process.env.LITELLM_API_KEY ?? "not-needed",
		configuration: {
			baseURL: process.env.LITELLM_BASE_URL,
		},
	});
	console.log("2");

	const graph = await Neo4jGraph.initialize({
		url: process.env.NEO4J_URI!,
		username: process.env.NEO4J_USERNAME!,
		password: process.env.NEO4J_PASSWORD!,
		database: process.env.NEO4J_DATABASE!, // ✅ explicitly specify database
	});

	console.log("3");

	qaChain = GraphCypherQAChain.fromLLM({ llm, graph });

	console.log("4");
	return qaChain;
}
