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
		return await this.formatOutput(analysis)
	}

	private async analyzeProject(): Promise<string> {
		const agent = createAgent({ model: this.llm })
		const readmeContent = await fs
			.readFile(`${this.projectPath}/README.md`, "utf-8")
			.catch(e => {
				logger.warn(`[PlannerAgent] No README.md found at ${this.projectPath}: ${e}`)
			})

		const prompt = prompts.get("planner/system", {
			fileTree: this.projectTree,
			readme: readmeContent as string,
		})

		const [messages, config] = new AgentInvokeBuilder()
			.withPrompt(prompt)
			.withRecursionLimit(100)
			.build()

		const result = await agent
			.invoke(messages, config)
			.then(result => {
				const lastMessage = (result.messages.at(-1)?.content ?? "").toString()
				logger.info(`[PlannerAgent] Agent response: ${lastMessage}`)
				return lastMessage
			})
			.catch(error => {
				logger.error(`[PlannerAgent] Agent error: ${error}`)
				throw error
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
