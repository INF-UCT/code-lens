import logger from "@/logger"

import { prompts } from "@/prompts"
import { llmFactory } from "@/llm/llm.factory"
import { HumanMessage } from "@langchain/core/messages"
import { DocGenerationInput } from "@/schemas/api.schema"
import { ExplorerOutput, ExplorerOutputSchema } from "@/schemas/explorer.schema"

class ExplorerAgent {
	constructor() {}

	async run(input: DocGenerationInput): Promise<ExplorerOutput> {
		logger.info("Starting Explorer Agent...")

		const model = llmFactory.createPlannerModel()
		const structuredModel = model.withStructuredOutput(ExplorerOutputSchema, {
			includeRaw: false,
		})

		const analyzePrompt = prompts.get("analyze-project", {
			flat_tree: input.flatTree,
		})

		const message = new HumanMessage(analyzePrompt)
		const result = await structuredModel.invoke([message])

		logger.info("Explorer Agent completed successfully.")

		logger.info("Analysis Result:")
		logger.info("  - Project Type: %s", result.projectType)
		logger.info("  - Technologies: %s", result.technologies.join(", "))
		logger.info("  - Features: %d", result.features.length)
		logger.info(
			"  - Sections: %s",
			result.sections.map((s: { title: string }) => s.title).join(", ")
		)

		return result
	}
}

export const explorerAgent = new ExplorerAgent()
