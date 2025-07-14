"use client";
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { GraphNode, GraphRelationship } from "@/app/models/finding";

const BasicNvlWrapper = dynamic(
	() => import("@neo4j-nvl/react").then((mod) => mod.BasicNvlWrapper),
	{ ssr: false }
);

export default function GraphPage() {
	const [nodes, setNodes] = useState<GraphNode[]>([]);
	const [rels, setRels] = useState<GraphRelationship[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const loadGraph = async () => {
			try {
				await fetch("/api/graph")
					.then((res) => res.json())
					.then((data) => {
						setNodes(data.nodes);
						setRels(data.rels);

						console.log("nodes", data.nodes);
						console.log("rels", data.rels);
					});
			} catch (err) {
				console.error("Failed to load graph", err);
			} finally {
				setLoading(false);
			}
		};

		loadGraph();
	}, []);

	if (loading || rels.length < 69)
		return (
			<div className='flex h-screen w-full items-center justify-center'>
				Loading graph...
			</div>
		);

	return (
		<div className='h-screen w-full'>
			{/* {nodes.length == 15 && (
				<BasicNvlWrapper
					key={`${nodes.map((n) => n.id).join("-")}-${rels.length}`}
					nodes={nodes}
					rels={rels}
					nvlOptions={{
						initialZoom: 1,
						instanceId: "id",
					}}
					onInitializationError={(err) => {
						console.error("Failed to initialize graph", err);
					}}

					// nvlCallbacks={{
					//   onNodeClick: (node) => console.log("Node clicked", node),
					// }}
				/>
			)} */}
		</div>
	);
}
