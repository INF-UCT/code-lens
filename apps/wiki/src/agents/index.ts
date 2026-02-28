import { ChatOpenAI } from "@langchain/openai"

export abstract class Agent<T> {
	constructor(protected llm: ChatOpenAI) {}

	public abstract run(): Promise<T>
	protected abstract formatOutput(rawOutput: string): Promise<T>
}

export { PlannerAgent } from "@/agents/planner/agent"
export { ExplorerAgent } from "@/agents/explorer/agent"
