import { ChatOpenAI } from "@langchain/openai"
import { vllmService } from "@/llm/vllm.service"

export class LLMFactory {
	/**
	 * Modelo para selección de archivos - Ultra restrictivo
	 * Usado SOLO para: select-summary-files
	 * Tokens mínimos para forzar respuestas cortas
	 */
	static createFileSelectorModel() {
		return new ChatOpenAI({
			modelName: vllmService.availableModels.DEEPSEEK,
			temperature: 0, // Completamente determinístico
			apiKey: "dummy",
			maxTokens: 500, // MUY limitado para forzar respuestas cortas
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		})
	}

	/**
	 * Modelo para planificación - Más determinístico
	 * Usado para: write-summary
	 */
	static createPlannerModel() {
		return new ChatOpenAI({
			modelName: vllmService.availableModels.DEEPSEEK,
			temperature: 0, // Más determinístico para JSON
			apiKey: "dummy",
			maxTokens: 800, // Reducido para forzar respuestas más cortas
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		})
	}

	/**
	 * Modelo para generación de secciones
	 * Usado para: write-sections
	 */
	static createSectionPlannerModel() {
		return new ChatOpenAI({
			modelName: vllmService.availableModels.DEEPSEEK,
			temperature: 0,
			apiKey: "dummy",
			maxTokens: 2000, // Más tokens para generar múltiples secciones
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		})
	}

	/**
	 * Modelo para escritura - Más creativo
	 * Usado para generar contenido de documentación
	 */
	static createWriterModel() {
		return new ChatOpenAI({
			modelName: vllmService.availableModels.DEEPSEEK,
			temperature: 0.3, // Balance entre creatividad y coherencia
			apiKey: "dummy",
			maxTokens: 8000, // Más tokens para generación de contenido largo
			configuration: {
				baseURL: vllmService.getBaseURL(),
			},
		})
	}
}
