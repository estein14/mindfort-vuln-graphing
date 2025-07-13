"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { BasicNvlWrapper } from "@neo4j-nvl/react";

export default function GraphPage() {
	const [nodes, setNodes] = useState<any[]>([]);
	const [rels, setRels] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadGraph = async () => {
			try {
				const res = await fetch("/api/graph");
				const { nodes, rels } = await res.json();

				setNodes(nodes);
				setRels(rels);

				console.log("nodes", nodes);
				console.log("rels", rels);

				const nodeIds = new Set(nodes.map((n: any) => n.id));
				rels.forEach((r: any) => {
					if (!nodeIds.has(r.start))
						console.warn("Missing start:", r.start);
					if (!nodeIds.has(r.end))
						console.warn("Missing end:", r.end);
				});
			} catch (err) {
				console.error("Failed to load graph", err);
			} finally {
				setLoading(false);
			}
		};

		loadGraph();
	}, []);

	if (loading) return <div>Loading graph...</div>;

	return (
		<div className='h-screen w-full'>
			<BasicNvlWrapper
				// key={`${nodes.length}-${rels.length}`}
				nodes={nodes}
				rels={rels}
				// nvlOptions={{
				//   layout: {
				//     type: "force",
				//     options: {
				//       springLength: 200,
				//     },
				//   },
				//   initialZoom: 1.5,
				// }}
				// nvlCallbacks={{
				//   onNodeClick: (node) => console.log("Node clicked", node),
				// }}
			/>
		</div>
	);
}
