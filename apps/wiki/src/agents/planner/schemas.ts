import z from "zod"

const KeyFileSchema = z.object({
	path: z.string().describe("The file path"),
	reason: z.string().describe("Why this file is important for this section"),
})

const SectionSchema = z.object({
	title: z.string().describe("Title of the section"),
	keyfiles: z.array(KeyFileSchema).describe("List of key files for this section"),
	description: z.string().describe("A tiny description of the section"),
})

export const PlannerAgentOutputSchema = z.object({
	sections: z.array(SectionSchema).describe("List of sections in the project"),
	summary: z.string().describe("A extended summary of the project"),
})

export type PlannerAgentOutput = z.infer<typeof PlannerAgentOutputSchema>
