import * as z from "zod"

export const ExplorerSectionSchema = z.object({
	title: z.string().nonempty(),
	description: z.string().nonempty(),
	files: z.array(z.string()),
})

export const ExplorerOutputSchema = z.object({
	overview: z.string().nonempty(),
	features: z.array(z.string()).min(1),
	projectType: z.string().nonempty(),
	technologies: z.array(z.string()),
	sections: z.array(ExplorerSectionSchema).min(2).max(6),
})

export type ExplorerSection = z.infer<typeof ExplorerSectionSchema>
export type ExplorerOutput = z.infer<typeof ExplorerOutputSchema>
