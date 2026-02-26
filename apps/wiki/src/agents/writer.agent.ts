import { Tools } from "@/mcp/types"
import { llmFactory } from "@/llm/llm.factory"
import { createAgent, ReactAgent, HumanMessage } from "langchain"
import { prompts } from "@/prompts"
import { ExplorerOutput } from "@/schemas/explorer.schema"

export interface WriterAgentOptions {
	fileSystemTools: Tools
	repositoryTree: string
}

export class WriterAgent<T> {
	private agent: ReactAgent
	private repositoryTree: string

	constructor(input: WriterAgentOptions) {
		const model = llmFactory.createWriterModel()

		const agent = createAgent({
			model,
			tools: input.fileSystemTools,
			systemPrompt: prompts.get("writer/system", {
				repositoryTree: input.repositoryTree,
			}),
		})

		this.agent = agent
		this.repositoryTree = input.repositoryTree
	}

	async run(input: ExplorerOutput) {
		const basePrompt = prompts.get("writer/write-docs", {})
	}
}
