import * as z from "zod"

export const DocGenerationDto = z.object({
	repoId: z.uuid({ version: "v4" }),
	repoPath: z.string().nonempty(),
	hierarchyTree: z.string().nonempty(),
	flatTree: z.string().nonempty(),
})

export type DocGenerationInput = z.infer<typeof DocGenerationDto>
