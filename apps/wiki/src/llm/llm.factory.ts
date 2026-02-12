import { ChatOpenAI } from "@langchain/openai"
import { vllmService } from "@/llm/vllm.service"

export class LLMFactory {
	static createPlannerModel() {
		return new ChatOpenAI({
			modelName: vllmService.availableModels.QWEN_3_4B,
			temperature: 0.1,
			apiKey: "dummy",
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		})
	}

	static createWriterModel() {
		return new ChatOpenAI({
			modelName: vllmService.availableModels.QWEN_3_4B,
			temperature: 0.3,
			apiKey: "dummy",
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		})
	}
}
