import logger from "@/utils/logger"

import { createAgent } from "langchain"
import { HumanMessage } from "@langchain/core/messages"

import { prompts } from "@/utils/prompts"
import { llmFactory } from "@/llm/llm.factory"
import { ExplorerOutputSchema, ExplorerAgentOutput } from "@/agents/explorer/schemas"

import { Agent } from "@/agents"
import { Tools } from "@/mcp/types"
import { fileSystemMCP } from "@/mcp/filesystem"

export class ExplorerAgent extends Agent<ExplorerAgentOutput> {
	constructor(
		private readonly fileTree: string,
		private readonly projectPath: string
	) {
		super(llmFactory.createModel())
	}

	public async run(): Promise<ExplorerAgentOutput> {
		const fileSystemClient = fileSystemMCP.getClient(this.projectPath)
		const fileSystemTools = await fileSystemClient.getTools()

		const analysis = await this.analyzeProject(fileSystemTools)
		const formattedOutput = await this.formatOutput(analysis)

		fileSystemClient.close()

		return formattedOutput
	}

	private async analyzeProject(fileSystemTools: Tools): Promise<string> {
		const agent = createAgent({
			model: this.llm,
			tools: fileSystemTools,
			systemPrompt: prompts.get("explorer/system"),
		})

		const message = new HumanMessage(
			prompts.get("explorer/analyze-project", {
				projectPath: this.projectPath,
				projectFileTree: this.fileTree,
			})
		)

		const result = await agent
			.invoke({
				messages: [message],
			})
			.then(result => {
				const lastMessage = (result.messages.at(-1)?.content ?? "").toString()
				logger.info(`[ExplorerAgent] Agent response: ${lastMessage}`)
				return lastMessage
			})
			.catch(error => {
				logger.error(`[ExplorerAgent] Error invoking agent: ${error}`)
				throw Error("Failed to analyze project")
			})

		return result
	}

	protected async formatOutput(rawOutput: string): Promise<ExplorerAgentOutput> {
		const formatterModel = this.llm.withStructuredOutput(ExplorerOutputSchema)
		const formatterMessage = new HumanMessage(
			prompts.get("explorer/format-output", {
				input: rawOutput,
			})
		)

		const output = await formatterModel
			.invoke([formatterMessage])
			.then(result => {
				logger.info(
					`[ExplorerAgent] Formatted output: ${JSON.stringify(result, null, 2)}`
				)
				return result
			})
			.catch(error => {
				logger.error(`[ExplorerAgent] Error formatting output: ${error}`)
				throw Error("Failed to format agent output")
			})

		return output
	}
}
