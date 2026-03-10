import fs from "node:fs/promises"
import path from "node:path"

import { WriterAgent } from "@/agents/writer/agent"
import { WikiStructure, WikiPage, WikiSection } from "@/agents/planner/schemas"
import { RetrievedChunk, rag } from "@/rag"
import env from "@/utils/env"
import logger from "@/utils/logger"

type GenerateDocsInput = {
	repoId: string
	plannerOutput: WikiStructure
}

type PageGenerationError = {
	pageId: string
	pageTitle: string
	error: string
}

type GeneratedDocsResult = {
	outputDir: string
	generatedPages: number
	errors: PageGenerationError[]
}

export class DocumentationGenerator {
	public async generate(input: GenerateDocsInput): Promise<GeneratedDocsResult> {
		const outputDir = path.join(env.WIKI_OUTPUT_DIR, input.repoId)

		await fs.rm(outputDir, { recursive: true, force: true })
		await fs.mkdir(outputDir, { recursive: true })

		const sectionMap = new Map(input.plannerOutput.sections.map(section => [section.id, section]))
		const pageMap = new Map(input.plannerOutput.pages.map(page => [page.id, page]))
		const orderedPages = this.orderPages(input.plannerOutput.sections, pageMap)
		const generatedFiles = new Map<string, string>()
		const errors: PageGenerationError[] = []

		for (const [index, page] of orderedPages.entries()) {
			const sectionTitle = this.resolveSectionTitle(page, sectionMap)
			const pageFileName = `${String(index + 1).padStart(2, "0")}-${this.toSlug(page.title)}.md`
			const pageOutputPath = path.join(outputDir, pageFileName)

			try {
				const contextChunks = await rag.retrievePageContext({
					projectId: input.repoId,
					sectionTitle,
					page,
				})

				const writerAgent = new WriterAgent({
					projectOverview: `${input.plannerOutput.title}\n\n${input.plannerOutput.description}`,
					projectFeatures: this.buildProjectFeatures(input.plannerOutput.sections),
					pageTitle: page.title,
					pageDescription: page.description,
					sectionTitle,
					relevantSources: this.buildRelevantSources(contextChunks),
					filesContent: this.buildFilesContent(contextChunks),
				})

				const writeResult = await writerAgent.run()

				if (writeResult.error) {
					throw new Error(writeResult.error)
				}

				await fs.writeFile(pageOutputPath, writeResult.value!, "utf-8")
				generatedFiles.set(page.id, pageFileName)
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				errors.push({
					pageId: page.id,
					pageTitle: page.title,
					error: message,
				})

				logger.error(`[DocsGenerator] Failed generating page ${page.id}: ${message}`)
			}
		}

		await this.writeIndexFile(outputDir, input.plannerOutput, generatedFiles)

		return {
			outputDir,
			generatedPages: generatedFiles.size,
			errors,
		}
	}

	private orderPages(
		sections: WikiSection[],
		pageMap: Map<string, WikiPage>
	): WikiPage[] {
		const ordered: WikiPage[] = []
		const used = new Set<string>()

		for (const section of sections) {
			for (const pageId of section.pages) {
				const page = pageMap.get(pageId)
				if (!page || used.has(page.id)) continue
				ordered.push(page)
				used.add(page.id)
			}
		}

		for (const page of pageMap.values()) {
			if (used.has(page.id)) continue
			ordered.push(page)
			used.add(page.id)
		}

		return ordered
	}

	private resolveSectionTitle(
		page: WikiPage,
		sectionMap: Map<string, WikiSection>
	): string {
		if (!page.parent_section) return "General"
		return sectionMap.get(page.parent_section)?.title ?? "General"
	}

	private buildProjectFeatures(sections: WikiSection[]): string {
		if (sections.length === 0) return "- Sin secciones detectadas"
		return sections.map(section => `- ${section.title}`).join("\n")
	}

	private buildRelevantSources(chunks: RetrievedChunk[]): string {
		if (chunks.length === 0) return "- No se recuperaron fuentes"

		return chunks
			.map(chunk => {
				const lineRange =
					typeof chunk.startLine === "number" && typeof chunk.endLine === "number"
						? `#L${chunk.startLine}-L${chunk.endLine}`
						: ""

				return `- ${chunk.source}${lineRange} (score=${chunk.score.toFixed(4)})`
			})
			.join("\n")
	}

	private buildFilesContent(chunks: RetrievedChunk[]): string {
		if (chunks.length === 0) {
			return "[SOURCE: none]\nNo hay contexto recuperado para esta página.\n[/SOURCE]"
		}

		return chunks
			.map(chunk => {
				const range =
					typeof chunk.startLine === "number" && typeof chunk.endLine === "number"
						? `${chunk.startLine}-${chunk.endLine}`
						: "n/a"

				return [
					`[SOURCE: ${chunk.source} | lines=${range} | score=${chunk.score.toFixed(4)}]`,
					chunk.content,
					`[/SOURCE]`,
				].join("\n")
			})
			.join("\n\n")
	}

	private async writeIndexFile(
		outputDir: string,
		structure: WikiStructure,
		generatedFiles: Map<string, string>
	): Promise<void> {
		const lines: string[] = []

		lines.push(`# ${structure.title}`)
		lines.push("")
		lines.push(structure.description)
		lines.push("")
		lines.push("## Estructura de documentación")
		lines.push("")

		for (const section of structure.sections) {
			lines.push(`### ${section.title}`)

			for (const pageId of section.pages) {
				const page = structure.pages.find(item => item.id === pageId)
				const fileName = generatedFiles.get(pageId)

				if (!page || !fileName) continue
				lines.push(`- [${page.title}](./${fileName})`)
			}

			lines.push("")
		}

		const indexPath = path.join(outputDir, "README.md")
		await fs.writeFile(indexPath, lines.join("\n").trim() + "\n", "utf-8")
	}

	private toSlug(value: string): string {
		const slug = value
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")

		if (!slug) return "documentacion"
		return slug
	}
}
