"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
	role: "user" | "agent";
	content: string;
}

export function Chat() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [reasonings, setReasonings] = useState<string[][]>([]);
	const [input, setInput] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState(0);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const funnyMessages = [
		"Thinking...",
		"Keep your arms and legs in the vehicle while querying...",
		"Consulting the security oracle...",
		"Decrypting the mysteries of cybersecurity...",
		"Running vulnerability scans on your patience...",
		"Teaching AI to speak security...",
		"Brewing a fresh pot of security insights...",
		"Summoning the security spirits...",
		"Converting coffee to code...",
		"Debugging the meaning of life...",
		"Loading security wisdom...",
		"Assembling the security Avengers...",
		"Consulting the ancient scrolls of cybersecurity...",
		"Bypassing the loading screen...",
		"Generating random excuses for delays...",
		"Waiting for the security gods to respond...",
	];

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	// Auto-scroll when messages change or loading state changes
	useEffect(() => {
		scrollToBottom();
	}, [messages, isLoading]);

	const sendMessage = async () => {
		if (!input.trim()) return;
		const userMsg = { role: "user" as const, content: input };
		setMessages((prev) => [...prev, userMsg]);
		setInput("");
		setIsLoading(true);
		setLoadingMessage(0);

		// Start with "Thinking..." for 10 seconds, then show one random funny message
		const timeoutId = setTimeout(() => {
			const randomIndex =
				Math.floor(Math.random() * (funnyMessages.length - 1)) + 1; // Skip index 0 ("Thinking...")
			setLoadingMessage(randomIndex);
		}, 10000);

		try {
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

			const agentMsg = { role: "agent" as const, content: data.answer };
			setMessages((prev) => [...prev, agentMsg]);
			setReasonings((prev) => [...prev, [...data.reasoning]]);
		} catch {
			setMessages((prev) => [
				...prev,
				{ role: "agent", content: "Error: Failed to get response" },
			]);
			setReasonings((prev) => [...prev, []]);
		} finally {
			clearTimeout(timeoutId);
			setIsLoading(false);
		}
	};

	return (
		<div className='flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4'>
			<div className='w-9/10 h-9/10 bg-white shadow-2xl rounded-2xl overflow-hidden border-2 border-gradient-to-r from-blue-400 via-purple-500 to-pink-500 flex flex-col'>
				{/* Header */}
				<div className='bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 flex-shrink-0'>
					<h1 className='text-white text-xl font-semibold'>
						Security Assistant
					</h1>
					<p className='text-blue-100 text-sm'>
						Ask me any questions about your security findings!
					</p>
				</div>

				{/* Messages Container */}
				<div className='flex-1 overflow-auto p-6 space-y-6 h-full'>
					{messages.length === 0 && (
						<div className='text-center text-gray-500 py-8'>
							<div className='text-4xl mb-4'>🔒</div>
							<p className='text-lg font-medium'>
								Welcome to your Security Assistant
							</p>
							<p className='text-sm'>
								Start a conversation to explore security
								findings
							</p>
						</div>
					)}
					{messages.map((msg, i) => (
						<div
							key={i}
							className={`flex ${
								msg.role === "user"
									? "justify-end"
									: "justify-start"
							}`}>
							<div
								className={`max-w-3xl ${
									msg.role === "user" ? "order-2" : "order-1"
								}`}>
								<div
									className={`px-4 py-3 rounded-2xl ${
										msg.role === "user"
											? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
											: "bg-gray-50 border border-gray-200 shadow-sm"
									}`}>
									<div
										className={`prose prose-sm max-w-none ${
											msg.role === "user"
												? "text-white"
												: "text-gray-800"
										}`}
										dangerouslySetInnerHTML={{
											__html: msg.content.includes(
												"<body>"
											)
												? msg.content
														.replace(
															/^[\s\S]*<body[^>]*>/,
															""
														)
														.replace(
															/<\/body>[\s\S]*$/,
															""
														)
												: msg.content,
										}}
									/>
								</div>
								{msg.role === "agent" &&
									reasonings[i] &&
									reasonings[i].length > 0 && (
										<details className='text-gray-500 ml-4 mt-2'>
											<summary className='cursor-pointer text-sm hover:text-gray-700 transition-colors'>
												🔍 View reasoning steps
											</summary>
											<ul className='list-disc list-inside mt-2 text-xs space-y-1'>
												{reasonings[i].map(
													(step, j) => (
														<li
															key={j}
															className='text-gray-600'>
															{step}
														</li>
													)
												)}
											</ul>
										</details>
									)}
							</div>
						</div>
					))}

					{/* Loading Indicator */}
					{isLoading && (
						<div className='flex justify-start'>
							<div className='max-w-3xl'>
								<div className='px-4 py-3 rounded-2xl bg-gray-50 border border-gray-200 shadow-sm'>
									<div className='flex items-center space-x-3'>
										<div className='flex space-x-1'>
											<div className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'></div>
											<div
												className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
												style={{
													animationDelay: "0.1s",
												}}></div>
											<div
												className='w-2 h-2 bg-blue-500 rounded-full animate-bounce'
												style={{
													animationDelay: "0.2s",
												}}></div>
										</div>
										<span className='text-sm text-gray-600 font-medium'>
											{funnyMessages[loadingMessage]}
										</span>
									</div>
								</div>
							</div>
						</div>
					)}
					{/* Invisible div for scrolling to bottom */}
					<div ref={messagesEndRef} />
				</div>

				{/* Input Bar */}
				<div className='p-6 bg-gray-50 border-t border-gray-200 flex-shrink-0'>
					<div className='flex gap-3 items-end'>
						<textarea
							className='flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white shadow-sm resize-none overflow-hidden'
							placeholder='Ask about your security findings, vulnerabilities, or best practices...'
							style={{
								color: "black",
								minHeight: "48px",
								maxHeight: "120px",
							}}
							value={input}
							onChange={(e) => {
								setInput(e.target.value);
								// Auto-resize
								e.target.style.height = "auto";
								e.target.style.height =
									Math.min(e.target.scrollHeight, 120) + "px";
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault();
									sendMessage();
								}
							}}
							rows={1}
						/>
						<button
							className='px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex-shrink-0'
							onClick={sendMessage}>
							Send
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
