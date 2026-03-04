import fs from "node:fs/promises"
import logger from "@/utils/logger"
import prompts from "@/utils/prompts"

import { createAgent } from "langchain"

import { llmFactory } from "@/llm/llm.factory"
import { Agent, AgentInvokeBuilder } from "@/agents"
import { WikiStructureSchema, WikiStructure } from "@/agents/planner/schemas"

export class PlannerAgent extends Agent<WikiStructure> {
	constructor(
		private readonly projectPath: string,
		private readonly projectTree: string
	) {
		super(llmFactory.createModel())
	}

	public async run(): Promise<WikiStructure> {
		const analysis = await this.analyzeProject()
		return analysis
	}

	private async analyzeProject(): Promise<WikiStructure> {
		const agent = this.llm.withStructuredOutput(WikiStructureSchema)
		const readmeContent = await fs
			.readFile(`${this.projectPath}/README.md`, "utf-8")
			.catch(e => {
				logger.warn(`[PlannerAgent] No README.md found at ${this.projectPath}: ${e}`)
			})

		const prompt = prompts.get("planner/system", {
			fileTree: this.projectTree,
			readme: readmeContent as string,
		})

		const result = await agent
			.invoke(prompt, { recursionLimit: 100 })
			.then(response => {
				logger.info(
					`[PlannerAgent] Analyzed project structure: ${JSON.stringify(response, null, 2)}`
				)
				return response
			})
			.catch(error => {
				logger.error(`[PlannerAgent] Error analyzing project: ${error}`)
				throw Error("Failed to analyze project structure")
			})

		return result
	}

	protected async formatOutput(rawOutput: string): Promise<WikiStructure> {
		const prompt = prompts.get("planner/format-output", {
			input: rawOutput,
		})

		const agent = createAgent({
			model: this.llm,
			responseFormat: WikiStructureSchema,
		})

		const [messages, config] = new AgentInvokeBuilder()
			.withPrompt(prompt)
			.withRecursionLimit(25)
			.build()

		const output = await agent
			.invoke(messages, config)
			.then(result => {
				logger.info(
					`[PlannerAgent] Formatted output: ${JSON.stringify(result, null, 2)}`
				)
				return result.structuredResponse
			})
			.catch(error => {
				logger.error(`[PlannerAgent] Error formatting output: ${error}`)
				throw Error("Failed to format planner output")
			})

		return output
	}
}
