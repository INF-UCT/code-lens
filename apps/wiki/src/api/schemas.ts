import * as z from "zod"

export const DocGenerationDto = z.object({
	repoId: z.string().uuid(),
	repoPath: z.string().nonempty(),
	repoTree: z.string().nonempty(),
})

export type DocGenerationInput = z.infer<typeof DocGenerationDto>
