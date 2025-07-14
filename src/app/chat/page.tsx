// src/app/chat/page.tsx
import { Chat } from "@/components/Chat";

export const metadata = {
	title: "Vulnerability Graph Chat",
};

export default function ChatPage() {
	return (
		<main className='h-screen flex flex-col'>
			<Chat />
		</main>
	);
}
