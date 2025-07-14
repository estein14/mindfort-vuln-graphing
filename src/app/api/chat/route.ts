import { runAgenticChat } from "@/lib/agent";
import { ChatMessage } from "@/lib/agentTools";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	const { message } = await req.json();
	if (typeof message !== "string") {
		return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
	}

	try {
		const chatMessages: ChatMessage[] = [
			{ role: "user", content: message },
		];
		const { answer, reasoning } = await runAgenticChat(chatMessages);
		return NextResponse.json({ answer, reasoning });
	} catch (err: unknown) {
		console.error("Chat error", err);
		return NextResponse.json({ error: "Agent failed" }, { status: 500 });
	}
}
