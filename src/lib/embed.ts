import axios from "axios";

const LITELLM_URL = `${process.env.LITELLM_BASE_URL}/embeddings`;
const LITELLM_KEY = process.env.LITELLM_API_KEY!;
const EMBEDDING_MODEL = "text-embedding-3-small";

export async function embedText(text: string): Promise<number[]> {
	const res = await axios.post(
		LITELLM_URL,
		{
			model: EMBEDDING_MODEL,
			input: text,
		},
		{
			headers: {
				Authorization: `Bearer ${LITELLM_KEY}`,
				"Content-Type": "application/json",
			},
		}
	);

	return res.data.data[0].embedding;
}
