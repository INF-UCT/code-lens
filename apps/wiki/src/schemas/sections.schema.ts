import * as v from "valibot"

export const SectionSchema = v.object({
	id: v.pipe(v.string(), v.nonEmpty(), v.uuid()),
	title: v.pipe(v.string(), v.nonEmpty()),
	keyFiles: v.array(v.pipe(v.string(), v.nonEmpty())),
})

export type Section = v.InferOutput<typeof SectionSchema>

export interface SectionPlan {
	repo_id: string
	sections: Section[]
}
