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
			temperature: 0, // Completamente determinístico - no conversación
			apiKey: "dummy",
			maxTokens: 500, // Suficiente para array de 10 rutas
			frequencyPenalty: 0, // Sin penalizaciones que generen creatividad
			presencePenalty: 0,
			topP: 0.1, // Muy bajo - fuerza tokens más probables
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
			temperature: 0, // Completamente determinístico
			apiKey: "dummy",
			maxTokens: 800, // Más tokens para summary completo
			frequencyPenalty: 0,
			presencePenalty: 0,
			topP: 0.1, // Muy bajo - fuerza tokens más probables
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
			maxTokens: 1500, // Reducido de 2000 - evita respuestas enormes
			topP: 0.1,
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
