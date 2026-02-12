import * as v from "valibot"

export const DocGenerationDto = v.object({
	repo_id: v.pipe(v.string(), v.nonEmpty(), v.uuid()),
	repo_path: v.pipe(v.string(), v.nonEmpty()),
	hierarchy_tree: v.pipe(v.string(), v.nonEmpty()),
	flat_tree: v.pipe(v.string(), v.nonEmpty()),
})

export type DocGenerationInput = v.InferOutput<typeof DocGenerationDto>
