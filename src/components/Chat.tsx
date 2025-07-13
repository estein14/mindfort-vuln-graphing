// src/components/Chat.tsx
"use client";

import { useState } from "react";

interface Message {
	role: "user" | "agent";
	content: string;
}

export function Chat() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [reasonings, setReasonings] = useState<string[][]>([]);
	const [input, setInput] = useState("");

	const sendMessage = async () => {
		if (!input.trim()) return;
		const userMsg = { role: "user" as const, content: input };
		setMessages((prev) => [...prev, userMsg]);
		setInput("");

		// call your API
		const res = await fetch("/api/chat", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ message: userMsg.content }),
		});
		const data = await res.json();
		if (data.error) {
			setMessages((prev) => [
				...prev,
				{ role: "agent", content: "Error: " + data.error },
			]);
			setReasonings((prev) => [...prev, []]);
			return;
		}
		console.log("Data");
		console.log(data);
		const agentMsg = { role: "agent" as const, content: data.answer };
		setMessages((prev) => [...prev, agentMsg]);
		setReasonings((prev) => [...prev, data.reasoning]);
		console.log("Reasonings");
		console.log(reasonings);
		console.log("Messages");
		console.log(messages);
	};

	return (
		<div className='flex flex-col h-full'>
			<div className='flex-1 overflow-auto p-4 space-y-4'>
				{messages.map((msg, i) => (
					<div
						key={i}
						className={
							msg.role === "user" ? "text-right" : "text-left"
						}>
						<p
							className={
								msg.role === "user"
									? "font-semibold text-blue-600"
									: "font-semibold text-green-700"
							}>
							{msg.role === "user" ? "You" : "Agent"}:
						</p>
						<p>{msg.content}</p>
						{msg.role === "agent" &&
							reasonings[i] &&
							reasonings[i].length > 0 && (
								<details className='text-gray-500 ml-4'>
									<summary>Reasoning steps</summary>
									<ul className='list-disc list-inside'>
										{reasonings[i].map((step, j) => (
											<li key={j}>{step}</li>
										))}
									</ul>
								</details>
							)}
					</div>
				))}
			</div>
			<div className='p-4 border-t flex gap-2'>
				<input
					type='text'
					className='flex-1 border rounded px-3 py-2'
					placeholder='Ask the graph agent...'
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && sendMessage()}
				/>
				<button
					className='bg-blue-600 text-white px-4 py-2 rounded'
					onClick={sendMessage}>
					Send
				</button>
			</div>
		</div>
	);
}
