import { Agent } from "@/agents"
import { llmFactory } from "@/llm/llm.factory"
import { PlannerAgentOutput } from "@/agents/planner/schemas"
import { ExplorerAgentOutput } from "@/agents/explorer/schemas"

export class PlannerAgent extends Agent<PlannerAgentOutput> {
	constructor(
		private readonly fileTree: string,
		private readonly projectPath: string,
		private readonly explorerOutput: ExplorerAgentOutput
	) {
		super(llmFactory.createModel())
	}

	public async run(): Promise<PlannerAgentOutput> {}
	protected async formatOutput(rawOutput: string): Promise<PlannerAgentOutput> {}
}
