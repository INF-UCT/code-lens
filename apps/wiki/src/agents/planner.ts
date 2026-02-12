import { VLLMClient } from "@/llm/client"
import { DocGenerationBody } from "@/schemas/sections.schema"

export class PlannerAgent {
	constructor(private vllmClient: VLLMClient) {}

	public async run(input: DocGenerationBody) {
		const { repo_id, file_tree, repo_path } = input
	}
}
