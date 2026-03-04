import env from "@/utils/env"
import logger from "@/utils/logger"

import { OpenAI } from "openai"

class VLLMService {
	public availableModels: Record<string, string> = {
		QWEN_3_5_9B: "qwen3.5:9b",
		NOMIC_EMBED_TEXT_V2: "nomic-embed-text-v2-moe:latest",
	}

	public getBaseURL(): string {
		return env.OLLAMA_URL
	}

	public async checkConnection(): Promise<void> {
		logger.info(`Connecting to Ollama at ${env.OLLAMA_URL}...`)

		const client = new OpenAI({
			baseURL: env.OLLAMA_URL,
			apiKey: "",
			timeout: 5000,
		})

		let response

		try {
			response = await client.models.list()
		} catch (error) {
			logger.error(`Failed to connect to Ollama: ${error}`)
			process.exit(1)
		}

		const models = response.data.map(m => m.id)

		logger.info(`Successfully connected to Ollama!`)
		logger.info(`Available models from Ollama: ${models.join(", ")}`)
	}
}

export const vllmService = new VLLMService()
