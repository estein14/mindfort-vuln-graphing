import { z } from "zod";

export const VulnerabilitySchema = z.object({
	id: z.string(),
	owasp_id: z.string().nullable().optional(),
	cwe_id: z.string(),
	cve_id: z.string().nullable().optional(),
	title: z.string(),
	severity: z.string(),
	description: z.string(),
	timestamp: z.string().nullable().optional(),
	vector: z.string(),
});

export const AssetSchema = z.object({
	type: z.string(),
	url: z.string().url().optional(),
	service: z.string().optional(),
	path: z.string().optional(),
	cluster: z.string().optional(),
	image: z.string().optional(),
	registry: z.string().optional(),
	repo: z.string().optional(),
});

export const PackageSchema = z
	.object({
		ecosystem: z.string(),
		name: z.string(),
		version: z.string(),
	})
	.optional();

export const FindingSchema = z.object({
	id: z.string(), // maps to finding_id in JSON ingestion
	scanner: z.string(),
	scan_id: z.string(),
	timestamp: z.string(),
	vulnerability: VulnerabilitySchema,
	asset: AssetSchema,
	package: PackageSchema,
});

type InferredRel = {
	from: string; // id
	to: string; // id
	type: "SHARED_CWE" | "COMMON_ROOT_CAUSE" | "TEMPORAL_CLUSTER";
	explanation: string;
};

// TypeScript types inferred from schemas
export type Finding = z.infer<typeof FindingSchema>;
export type Vulnerability = z.infer<typeof VulnerabilitySchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Package = z.infer<typeof PackageSchema>;
