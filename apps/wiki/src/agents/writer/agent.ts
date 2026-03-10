import prompts from "@/utils/prompts"

import { Agent } from "@/agents"
import { llmService } from "@/utils/llm"
import { Err, Ok, PromiseResult, safeAsyncTry } from "@/utils/result"

type WriterAgentInput = {
	projectOverview: string
	projectFeatures: string
	pageTitle: string
	pageDescription: string
	sectionTitle: string
	relevantSources: string
	filesContent: string
}

export class WriterAgent extends Agent<string> {
	constructor(private readonly input: WriterAgentInput) {
		super(llmService.createModel({ temperature: 0.1, maxTokens: 5000 }))
	}

	public async run(): PromiseResult<string> {
		const prompt = prompts.get("writer/writer", {
			project_overview: this.input.projectOverview,
			project_features: this.input.projectFeatures,
			page_title: this.input.pageTitle,
			section_title: this.input.sectionTitle,
			page_description: this.input.pageDescription,
			relevant_sources: this.input.relevantSources,
			files_content: this.input.filesContent,
		})

		const { value: response, error } = await safeAsyncTry(
			this.llm.invoke(prompt, { recursionLimit: 100 })
		)

		if (error) {
			return Err(`[WriterAgent] Error generating markdown: ${error}`)
		}

		const markdown = this.extractContent(response?.content)

		if (!markdown) {
			return Err("[WriterAgent] Empty response from language model")
		}

		return Ok(markdown)
	}

	private extractContent(content: unknown): string {
		if (typeof content === "string") return content.trim()
		if (!Array.isArray(content)) return ""

		const result = content
			.map(item => {
				if (typeof item === "string") return item
				if (typeof item === "object" && item !== null && "text" in item) {
					const text = (item as { text?: unknown }).text
					if (typeof text === "string") return text
				}

				return ""
			})
			.join("\n")
			.trim()

		return result
	}
}

export type { WriterAgentInput }
