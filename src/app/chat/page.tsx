// src/app/chat/page.tsx
import { Chat } from "@/components/Chat";

export const metadata = {
	title: "Vulnerability Graph Chat",
};

export default function ChatPage() {
	return (
		<main className='h-screen flex flex-col'>
			<header className='bg-white shadow p-4'>
				<h1 className='text-2xl font-bold'>Vulnerability Graph Chat</h1>
			</header>
			<Chat />
		</main>
	);
}
