import z from "zod"

const WikiPageSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	importance: z.enum(["high", "medium", "low"]),
	relevant_files: z.array(z.string()),
	related_pages: z.array(z.string()),
	parent_section: z.string().optional().nullable(),
})

const WikiSectionSchema = z.object({
	id: z.string(),
	title: z.string(),
	pages: z.array(z.string()), // IDs de pages
	subsections: z.array(z.string()), // IDs de otras sections
})

export const WikiStructureSchema = z.object({
	title: z.string(),
	description: z.string(),
	sections: z.array(WikiSectionSchema),
	pages: z.array(WikiPageSchema),
})

export type WikiPage = z.infer<typeof WikiPageSchema>
export type WikiSection = z.infer<typeof WikiSectionSchema>
export type WikiStructure = z.infer<typeof WikiStructureSchema>
