import { vllmService } from "@/llm/vllm.service"
import { ChatOpenAI, ChatOpenAIFields } from "@langchain/openai"

class LLMFactory {
	public createModel(temperature: number = 0, maxTokens?: number): ChatOpenAI {
		const options: ChatOpenAIFields = {
			model: vllmService.availableModels.QWEN_3_4B,
			temperature,
			apiKey: "dummy",
			maxTokens,
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		}

		return new ChatOpenAI(options)
	}
}

export const llmFactory = new LLMFactory()
