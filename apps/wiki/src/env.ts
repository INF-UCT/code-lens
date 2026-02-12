import * as v from "valibot"

const schema = v.object({
	VLLM_URL: v.pipe(v.string(), v.nonEmpty("VLLM_URL env var is required")),
	WIKI_SERVICE_API_KEY: v.pipe(
		v.string(),
		v.nonEmpty("WIKI_SERVICE_API_KEY env var is required")
	),
})

export default v.parse(schema, process.env)
