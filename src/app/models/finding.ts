import { z } from "zod";

// Base Finding Schema
export const FindingSchema = z.object({
	finding_id: z.string(),
	vuln_title: z.string(),
	vuln_description: z.string(),
	vuln_severity: z.string(),
	vuln_vector: z.string(),
	vuln_owasp_id: z.string().nullable().optional(),
	vuln_cwe_id: z.string().nullable().optional(),
	vuln_cve_id: z.string().nullable().optional(),
	asset_type: z.string().nullable().optional(),
	asset_url: z.string().nullable().optional(),
	asset_path: z.string().nullable().optional(),
	asset_service: z.string().nullable().optional(),
	asset_cluster: z.string().nullable().optional(),
	asset_repo: z.string().nullable().optional(),
	asset_registry: z.string().nullable().optional(),
	asset_image: z.string().nullable().optional(),
	pkg_name: z.string().nullable().optional(),
	pkg_version: z.string().nullable().optional(),
	pkg_ecosystem: z.string().nullable().optional(),
	scanner: z.string(),
	scan_id: z.string(),
	timestamp: z.string(),
});

// Graph Node Schema
export const GraphNodeSchema = z.object({
	id: z.string(),
	labels: z.array(z.string()),
	properties: z.record(z.unknown()),
});

// Graph Relationship Schema
export const GraphRelationshipSchema = z.object({
	id: z.string(),
	type: z.string(),
	start: z.string(),
	end: z.string(),
	properties: z.record(z.unknown()),
});

// Graph Data Schema
export const GraphDataSchema = z.object({
	nodes: z.array(GraphNodeSchema),
	rels: z.array(GraphRelationshipSchema),
});

// Enrichment Node Schema
export const EnrichmentNodeSchema = z.object({
	id: z.string(),
	labels: z.array(z.string()),
	properties: z.record(z.unknown()),
	relationships: z.array(
		z.object({
			type: z.string(),
			target: z.string(),
		})
	),
});

// LLM Response Schema for Enrichment
export const EnrichmentResponseSchema = z.object({
	result: z.enum(["yes", "no"]),
	explanation: z.string(),
});

// Finding Properties Schema (for enrichment tools)
export const FindingPropertiesSchema = z.object({
	finding_id: z.string(),
	vuln_description: z.string(),
	vuln_cwe_id: z.string().optional(),
	vuln_owasp_id: z.string().optional(),
	vuln_title: z.string().optional(),
	vuln_vector: z.string().optional(),
	asset_type: z.string().optional(),
	asset_url: z.string().optional(),
	asset_path: z.string().optional(),
	asset_service: z.string().optional(),
	asset_cluster: z.string().optional(),
	asset_repo: z.string().optional(),
	asset_registry: z.string().optional(),
	asset_image: z.string().optional(),
	pkg_name: z.string().optional(),
	pkg_version: z.string().optional(),
	pkg_ecosystem: z.string().optional(),
});

// Enrichment Node with Properties Schema
export const EnrichmentNodeWithPropertiesSchema = z.object({
	properties: FindingPropertiesSchema,
});

// TypeScript types inferred from schemas
export type Finding = z.infer<typeof FindingSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphRelationship = z.infer<typeof GraphRelationshipSchema>;
export type GraphData = z.infer<typeof GraphDataSchema>;
export type EnrichmentNode = z.infer<typeof EnrichmentNodeSchema>;
export type EnrichmentResponse = z.infer<typeof EnrichmentResponseSchema>;
export type FindingProperties = z.infer<typeof FindingPropertiesSchema>;
export type EnrichmentNodeWithProperties = z.infer<
	typeof EnrichmentNodeWithPropertiesSchema
>;
