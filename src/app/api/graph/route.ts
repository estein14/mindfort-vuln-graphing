import { driver } from "@/lib/graph";
import { NextResponse } from "next/server";
import { GraphNode, GraphRelationship } from "@/app/models/finding";

// Graph retrieval function for visualization
const getGraph = async () => {
	const session = driver.session();

	try {
		const result = await session.run(`MATCH (n)-[r]->(m) RETURN n, r, m`);

		const nodesMap: Record<string, GraphNode> = {};
		const rels: GraphRelationship[] = [];

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
		return { nodes, rels };
	} finally {
		await session.close();
	}
};

export async function GET() {
	try {
		const graph = await getGraph();
		return NextResponse.json(graph, { status: 200 });
	} catch (err) {
		console.error(err);
		return NextResponse.json(
			{ error: "Failed to fetch graph" },
			{ status: 500 }
		);
	}
}
