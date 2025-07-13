// src/lib/vectorStore.ts
import cosineSimilarity from "compute-cosine-similarity";

interface MemoryItem {
	embedding: number[];
	text: string;
}

const memoryVectors: MemoryItem[] = [];

export function addMemory(embedding: number[], text: string) {
	memoryVectors.push({ embedding, text });
}

export function retrieveSimilarMemories(
	embedding: number[],
	topK: number = 3
): string[] {
	const similarities = memoryVectors.map((item) => ({
		text: item.text,
		similarity: cosineSimilarity(item.embedding, embedding),
	}));

	similarities.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

	return similarities.slice(0, topK).map((item) => item.text);
}
