import fs from "node:fs/promises"
import path from "node:path"

import logger from "@/utils/logger"
import prompts from "@/utils/prompts"

import { createAgent } from "langchain"
import { llmFactory } from "@/llm/llm.factory"

import { Agent, AgentInvokeBuilder } from "@/agents"
import { WriterAgentOutput } from "@/agents/writer/schemas"

/** Max bytes to read per file — prevents flooding the context window */
const MAX_FILE_BYTES = 12_000

async function readFileSafe(filePath: string): Promise<string> {
	try {
		const handle = await fs.open(filePath, "r")
		try {
			const buf = Buffer.alloc(MAX_FILE_BYTES)
			const { bytesRead } = await handle.read(buf, 0, MAX_FILE_BYTES, 0)
			const content = buf.slice(0, bytesRead).toString("utf-8")
			const truncated = bytesRead === MAX_FILE_BYTES
			return truncated ? content + "\n… (truncated)" : content
		} finally {
			await handle.close()
		}
	} catch {
		return "(file not found or unreadable)"
	}
}

function toSlug(title: string): string {
	return title
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
}

export interface WriterAgentInput {
	projectPath: string
	repoId: string
	sectionIndex: number
	sectionTitle: string
	sectionDescription: string
	keyfiles: Array<{ path: string; reason: string }>
	projectSummary: string
}

export class WriterAgent extends Agent<WriterAgentOutput> {
	constructor(private readonly input: WriterAgentInput) {
		super(llmFactory.createModel(0.3))
	}

	public async run(): Promise<WriterAgentOutput> {
		const filesContent = await this.readKeyFiles()
		const markdown = await this.writeSection(filesContent)
		const outputPath = await this.persist(markdown)

		return {
			sectionTitle: this.input.sectionTitle,
			outputPath,
			content: markdown,
		}
	}

	private async readKeyFiles(): Promise<string> {
		const parts: string[] = []

		for (const file of this.input.keyfiles) {
			const absPath = path.resolve(this.input.projectPath, file.path)
			const content = await readFileSafe(absPath)
			parts.push(`### ${file.path}\n\`\`\`\n${content}\n\`\`\``)
		}

		return parts.join("\n\n")
	}

	private async writeSection(filesContent: string): Promise<string> {
		const prompt = prompts.get("writer/write-docs", {
			project_overview: this.input.projectSummary,
			project_features: this.input.keyfiles.map(f => f.reason).join("; "),
			section_title: this.input.sectionTitle,
			section_description: this.input.sectionDescription,
			files_content: filesContent,
		})

		const agent = createAgent({
			model: this.llm,
			systemPrompt: prompts.get("writer/system"),
		})

		const [messages, config] = new AgentInvokeBuilder()
			.withPrompt(prompt)
			.withRecursionLimit(5)
			.build()

		const result = await agent
			.invoke(messages, config)
			.then(result => {
				const content = (result.messages.at(-1)?.content ?? "").toString()
				logger.info(
					`[WriterAgent] Section "${this.input.sectionTitle}" written (${content.length} chars)`
				)
				return content
			})
			.catch(error => {
				logger.error(`[WriterAgent] Error writing section: ${error}`)
				throw new Error(`Failed to write section: ${this.input.sectionTitle}`)
			})

		return result
	}

	private async persist(markdown: string): Promise<string> {
		const n = String(this.input.sectionIndex + 1).padStart(2, "0")
		const slug = toSlug(this.input.sectionTitle)
		const outputDir = path.resolve("/wiki_output", this.input.repoId)
		const outputPath = path.join(outputDir, `${n}-${slug}.md`)

		await fs.mkdir(outputDir, { recursive: true })
		await fs.writeFile(outputPath, markdown, "utf-8")

		logger.info(`[WriterAgent] Wrote ${outputPath}`)
		return outputPath
	}

	// WriterAgent does not need a separate format pass — the LLM writes final Markdown directly
	protected async formatOutput(_rawOutput: string): Promise<WriterAgentOutput> {
		throw new Error("Not used — WriterAgent.run() handles formatting inline")
	}
}
