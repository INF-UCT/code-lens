import env from "@/utils/env"
import logger from "@/utils/logger"

import { ChatOpenAI } from "@langchain/openai"

interface ModelOptions {
	temperature?: number
	maxTokens?: number
}

class LLMService {
	public availableModels: Record<string, string> = {
		QWEN_3_5_9B: "qwen3.5:9b",
		NOMIC_EMBED_TEXT_V2: "nomic-embed-text-v2-moe:latest",
	}

	public getBaseURL(): string {
		return env.OLLAMA_URL
	}

	public createModel(options?: ModelOptions): ChatOpenAI {
		const modelOptions = {
			model: llmService.availableModels.QWEN_3_5_9B,
			temperature: options?.temperature ?? 0.0,
			apiKey: "dummy",
			maxTokens: options?.maxTokens,
			configuration: {
				baseURL: llmService.getBaseURL(),
			},
		}

		return new ChatOpenAI(modelOptions)
	}

	public async checkConnection(): Promise<void> {
		logger.info(`Connecting to Ollama at ${env.OLLAMA_URL}...`)

		try {
			const response = await fetch(`${env.OLLAMA_URL}/models`, {
				headers: {
					Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
				},
			})

			const data = await response.json()

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const models = (data.data as any).map((model: any) => model["id"])
			logger.info(`Available models from Ollama: ${models.join(", ")}`)
		} catch (error) {
			logger.error(`Failed to connect to Ollama at ${env.OLLAMA_URL}:`, error)
			throw new Error(`Unable to connect to Ollama at ${env.OLLAMA_URL}`)
		}
	}
}

export const llmService = new LLMService()
