import type { NextApiRequest, NextApiResponse } from "next";
import { driver } from "@/lib/graph";
import { NextResponse } from "next/server";

export async function GET() {
	const session = driver.session();

	try {
		const result = await session.run(`MATCH (n)-[r]->(m) RETURN n, r, m`);

		const nodesMap: Record<string, any> = {};
		const rels: any[] = [];

		result.records.forEach((record) => {
			const n = record.get("n");
			const m = record.get("m");
			const r = record.get("r");

			const nId = n.identity.toString();
			const mId = m.identity.toString();
			const rStart = r.start.toString();
			const rEnd = r.end.toString();

			nodesMap[nId] = {
				id: nId,
				labels: n.labels,
				properties: Object.fromEntries(Object.entries(n.properties)),
			};

			nodesMap[mId] = {
				id: mId,
				labels: m.labels,
				properties: Object.fromEntries(Object.entries(m.properties)),
			};

			rels.push({
				id: r.identity.toString(),
				type: r.type,
				start: rStart,
				end: rEnd,
				properties: Object.fromEntries(Object.entries(r.properties)),
			});
		});

		const nodes = Object.values(nodesMap);
		return NextResponse.json({ nodes, rels }, { status: 200 });
	} catch (err) {
		console.error(err);
		return NextResponse.json(
			{ error: "Failed to fetch graph" },
			{ status: 500 }
		);
	} finally {
		await session.close();
	}
}
