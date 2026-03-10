import fs from "node:fs/promises"
import prompts from "@/utils/prompts"

import { Agent } from "@/agents"
import { llmService } from "@/utils/llm"
import { WikiStructureSchema, WikiStructure } from "@/agents/planner/schemas"
import { Err, Ok, PromiseResult, safeAsyncTry } from "@/utils/result"

export class PlannerAgent extends Agent<WikiStructure> {
	constructor(
		private readonly projectPath: string,
		private readonly projectTree: string
	) {
		super(llmService.createModel())
	}

	public async run(): PromiseResult<WikiStructure> {
		return await this.analyzeProject()
	}

	private async analyzeProject(): PromiseResult<WikiStructure> {
		const agent = this.llm.withStructuredOutput<WikiStructure>(WikiStructureSchema)

		const { value: readme, error } = await safeAsyncTry(
			fs.readFile(`${this.projectPath}/README.md`, "utf-8")
		)

		if (error) {
			return Err(`[PlannerAgent] Failed to read README.md: ${error}`)
		}

		const prompt = prompts.get("planner/planner", {
			fileTree: this.projectTree,
			readme: readme!,
		})

		const { value: result, error: analysisError } = await safeAsyncTry(
			agent.invoke(prompt, { recursionLimit: 100 })
		)

		if (analysisError) {
			return Err(`[PlannerAgent] Error analyzing project: ${analysisError}`)
		}

		return Ok(result!)
	}
}
