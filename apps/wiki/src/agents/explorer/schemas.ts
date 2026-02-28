import z from "zod"

export const ExplorerOutputSchema = z.object({
	keyfiles: z
		.array(
			z.object({
				path: z.string().describe("Relative file path"),
				reason: z
					.string()
					.describe("Why this file is key to understanding the project"),
			})
		)
		.length(10),
	summary: z.string().describe("What the project does in 2-3 sentences"),
	technologies: z
		.array(z.string())
		.describe("List of technologies used in the project"),
})

export type ExplorerAgentOutput = z.infer<typeof ExplorerOutputSchema>
