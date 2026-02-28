import env from "@/utils/env"
import logger from "@/utils/logger"

import { OpenAI } from "openai"

class VLLMService {
	public availableModels: Record<string, string> = {
		QWEN_3_4B: "Qwen/Qwen3-4B",
		DEEPSEEK: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
	}

	public getBaseURL(): string {
		return env.VLLM_URL
	}

	public async checkConnection(): Promise<void> {
		logger.info(`Connecting to vLLM at ${env.VLLM_URL}...`)

		const client = new OpenAI({
			baseURL: env.VLLM_URL,
			apiKey: "",
			timeout: 5000,
		})

		let response

		try {
			response = await client.models.list()
		} catch (error) {
			logger.error(`Failed to connect to vLLM: ${error}`)
			process.exit(1)
		}

		const models = response.data.map(m => m.id)

		logger.info(`Successfully connected to vLLM!`)
		logger.info(`Available models from vLLM: ${models.join(", ")}`)
	}
}

export const vllmService = new VLLMService()
