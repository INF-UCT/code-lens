import * as z from "zod"

const schema = z.object({
	VLLM_URL: z.string().nonempty("VLLM_URL env var is required"),
	WIKI_SERVICE_API_KEY: z
		.string()
		.nonempty("WIKI_SERVICE_API_KEY env var is required"),
})

export default schema.parse(process.env)
