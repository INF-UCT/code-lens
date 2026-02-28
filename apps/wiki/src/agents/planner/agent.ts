import { llmFactory } from "@/llm/llm.factory"
import { ExplorerAgentOutput } from "@/agents/explorer/schemas"
import { prompts } from "@/utils/prompts"
import { fileSystemMCP } from "@/mcp/filesystem"
import { createAgent, HumanMessage } from "langchain"
import { Tools } from "@/mcp/types"
import logger from "@/utils/logger"
import { Agent } from "@/agents"
import { PlannerAgentOutput, PlannerAgentOutputSchema } from "./schemas"

export class PlannerAgent extends Agent<PlannerAgentOutput> {
	constructor(
		private readonly projectPath: string,
		private readonly explorerOutput: ExplorerAgentOutput
	) {
		super(llmFactory.createModel())
	}

	public async run(): Promise<PlannerAgentOutput> {
		const mcpClient = fileSystemMCP.getClient(this.projectPath)
		const mcpTools = await mcpClient.getTools()

		const analysis = await this.analyzeProject(mcpTools)
		const formattedOutput = await this.formatOutput(analysis)

		mcpClient.close()

		return formattedOutput
	}

	private async analyzeProject(mcpTools: Tools): Promise<string> {
		const agent = createAgent({
			model: this.llm,
			tools: mcpTools,
			systemPrompt: prompts.get("planner/system"),
		})

		const message = new HumanMessage(
			prompts.get("planner/analyze-sections", {
				projectPath: this.projectPath,
				keyfiles: this.explorerOutput.keyfiles
					.map(file => `- ${file.path}: ${file.reason}`)
					.join("\n"),
				summary: this.explorerOutput.summary,
				technologies: this.explorerOutput.technologies.join(", "),
			})
		)

		const result = await agent
			.invoke(
				{
					messages: [message],
				},
				{ recursionLimit: 100 }
			)
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

	protected async formatOutput(rawOutput: string): Promise<PlannerAgentOutput> {
		const formatterModel = this.llm.withStructuredOutput(PlannerAgentOutputSchema)
		const formatterMessage = new HumanMessage(
			prompts.get("planner/format-output", {
				input: rawOutput,
			})
		)

		const output = await formatterModel
			.invoke([formatterMessage])
			.then(result => {
				logger.info(
					`[PlannerAgent] Formatted output: ${JSON.stringify(result, null, 2)}`
				)
				return result
			})
			.catch(error => {
				logger.error(`[PlannerAgent] Error formatting output: ${error}`)
				throw Error("Failed to format planner output")
			})

		return output
	}
}
