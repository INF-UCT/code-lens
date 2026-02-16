import env from "@/env"

import { OpenAI } from "openai"
import { Result } from "@ghaerdi/rustify"

class VLLMService {
	public availableModels: Record<string, string> = {
		QWEN_3_4B: "Qwen/Qwen3-4B",
		DEEPSEEK: "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
	}

	public getBaseURL(): string {
		return env.VLLM_URL
	}

	public async checkConnection(): Promise<void> {
		console.log(`🔌 Connecting to vLLM at ${env.VLLM_URL}...`)

		const client = new OpenAI({
			baseURL: env.VLLM_URL,
			apiKey: "",
			timeout: 5000,
		})

		const response = await Result.fromAsync(() => client.models.list())

		if (!response.isOk()) {
			console.error(`❌ Failed to connect to vLLM: ${response.unwrapErr()}`)
			process.exit(1)
		}

		const models = response.unwrap().data.map(m => m.id)

		console.log(`✅ Connected to vLLM successfully!`)
		console.log(`📋 Available models: ${models.join(", ")}\n`)
	}
}

export const vllmService = new VLLMService()
