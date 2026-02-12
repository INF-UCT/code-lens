import { prompts } from "@/prompts"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { LLMFactory } from "@/llm/llm.factory"
import { DocGenerationInput } from "@/schemas/api.schema"

import {
	Section,
	SectionsGenSchema,
	SelectFilesSchema,
	SummaryGenSchema,
} from "@/schemas/sections.schema"

class PlannerAgent {
	public async run(input: DocGenerationInput) {
		const selectedFiles = await this.selectSummaryFiles(input)
		const summary = await this.writeSummary(input.repoPath, selectedFiles)

		const sections = await this.writeSections(input, summary)

		console.log("Selected files for summary generation:", selectedFiles)
		console.log("Final summary for repository:", summary)

		console.log("Generated sections for documentation:", sections)
	}

	async selectSummaryFiles(input: DocGenerationInput): Promise<string[]> {
		const plannerModel = LLMFactory.createPlannerModel()

		const structuredModel = plannerModel.withStructuredOutput(SelectFilesSchema, {
			method: "jsonMode",
		})

		const selectSummaryFilesPrompt = await prompts.get("select-summary-files", {
			flat_tree: input.flatTree,
			hierarchy_tree: input.hierarchyTree,
		})

		const message = {
			role: "user",
			content: selectSummaryFilesPrompt,
		}

		const { files } = await structuredModel.invoke([message])

		return files
	}

	async writeSummary(repoPath: string, files: string[]): Promise<string> {
		const plannerModel = LLMFactory.createPlannerModel()

		const structuredModel = plannerModel.withStructuredOutput(SummaryGenSchema, {
			method: "jsonMode",
		})

		const relevantFilesContent = await this.formatRelevantFiles(repoPath, files)

		const writeSummaryPrompt = await prompts.get("write-summary", {
			project_files_content: relevantFilesContent,
		})

		const message = {
			role: "user",
			content: writeSummaryPrompt,
		}

		const { summary } = await structuredModel.invoke([message])

		return summary
	}

	async writeSections(
		repoInfo: DocGenerationInput,
		summary: string
	): Promise<Section[]> {
		const plannerModel = LLMFactory.createPlannerModel()

		const structuredModel = plannerModel.withStructuredOutput(SectionsGenSchema, {
			method: "jsonMode",
		})

		const writeSummaryPrompt = await prompts.get("write-sections", {
			project_summary: summary,
			hierarchy_tree: repoInfo.hierarchyTree,
			flat_file_list: repoInfo.flatTree,
		})

		const message = {
			role: "user",
			content: writeSummaryPrompt,
		}

		const { sections } = await structuredModel.invoke([message])

		return sections
	}

	async formatRelevantFiles(repoPath: string, files: string[]): Promise<string> {
		// ### path/al/archivo
		// <contenido>
		// ---

		let content = ""

		for (const filePath of files) {
			content += `### ${filePath}\n`

			const fullFilePath = `${repoPath}/${filePath}`
				.replace(/\/+/g, "/") // Reemplaza múltiples '/' por uno solo
				.replace(/\/\.\//g, "/") // Elimina '/./' del path
				.replace(/\/+$/g, "") // Elimina '/' al final del path

			if (!existsSync(fullFilePath)) {
				continue
			}

			const fileContent = await readFile(fullFilePath, "utf-8")

			content += `${fileContent}\n`
			content += "---\n"
		}

		return content
	}
}

export const plannerAgent = new PlannerAgent()
