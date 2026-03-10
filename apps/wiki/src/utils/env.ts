import * as z from "zod"

const schema = z.object({
	OLLAMA_URL: z.string().nonempty("VLLM_URL env var is required"),
	WIKI_SERVICE_API_KEY: z
		.string()
		.nonempty("WIKI_SERVICE_API_KEY env var is required"),
	QDRANT_URL: z.string().nonempty("QDRANT_URL env var is required"),
	WIKI_OUTPUT_DIR: z.string().default("/app/repos/wiki_output"),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
})

export default schema.parse(process.env)
