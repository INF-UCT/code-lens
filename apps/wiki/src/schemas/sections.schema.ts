import * as z from "zod"

export const SectionSchema = z.object({
	title: z.string().nonempty(),
	keyFiles: z.array(z.string().nonempty()),
	tinySummary: z.string().nonempty(),
})

export const SectionsGenSchema = z.object({
	sections: z.array(SectionSchema),
})

export type Section = z.infer<typeof SectionSchema>

export const SelectFilesSchema = z.object({
	files: z
		.array(z.string())
		.max(10)
		.describe("Array de hasta 10 archivos seleccionados"),
})

export type SelectFilesOutput = z.infer<typeof SelectFilesSchema>

export const SummaryGenSchema = z.object({
	summary: z.string().nonempty(),
})

export type SummaryGenOutput = z.infer<typeof SummaryGenSchema>
