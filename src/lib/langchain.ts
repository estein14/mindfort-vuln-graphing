// import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";
// import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
// import { ChatLiteLLM } from "langchain/chat_models";
// import "dotenv/config";

// const graph = await Neo4jGraph.initialize({
// 	url: process.env.NEO4J_URL!,
// 	username: process.env.NEO4J_USERNAME!,
// 	password: process.env.NEO4J_PASSWORD!,
// });

// const llm = new ChatLiteLLM({
// 	model: "gpt-4.1",
// 	basePath: process.env.LITELLM_API_BASE!,
// 	apiKey: process.env.LITELLM_API_KEY!,
// 	temperature: 0.2,
// });

// const chain = GraphCypherQAChain.fromLLM({
// 	llm,
// 	graph,
// });

// const question = "What vulnerabilities affect Apache Struts?";
// const result = await chain.invoke({ input: question });

// console.log("\n🔎 Question:", question);
// console.log("💬 Answer:", result.text);
