import Link from "next/link";

export default function Home() {
	return (
		<div className='flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4'>
			<div className='w-full max-w-xl bg-white shadow-2xl rounded-2xl border-2 border-gradient-to-r from-blue-400 via-purple-500 to-pink-500 flex flex-col items-center px-8 py-12 gap-8'>
				<div className='flex flex-col items-center gap-2'>
					<h1 className='text-3xl font-bold text-gray-800 mb-2 text-center'>
						MindFort Vulnerability Graphing
					</h1>
					<p className='text-gray-600 text-center text-lg max-w-md'>
						Visualize, analyze, and understand your security
						vulnerabilities. MindFort helps you explore findings,
						see relationships, and get actionable insights to
						improve your security posture.
					</p>
				</div>
				<Link
					href='/chat'
					className='px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-lg mt-4'>
					Get Started →
				</Link>
			</div>
		</div>
	);
}
