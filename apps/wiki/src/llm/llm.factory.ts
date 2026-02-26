import { vllmService } from "@/llm/vllm.service"
import { ChatOpenAI, ChatOpenAIFields } from "@langchain/openai"

class LLMFactory {
	public createPlannerModel(): ChatOpenAI {
		const options: ChatOpenAIFields = {
			model: vllmService.availableModels.QWEN_3_4B,
			temperature: 0.1,
			apiKey: "dummy",
			maxTokens: 4000,
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		}

		return new ChatOpenAI(options)
	}

	public createWriterModel(): ChatOpenAI {
		const options: ChatOpenAIFields = {
			model: vllmService.availableModels.QWEN_3_4B,
			temperature: 0,
			apiKey: "dummy",
			maxTokens: 4000,
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		}

		return new ChatOpenAI(options)
	}
}

export const llmFactory = new LLMFactory()
