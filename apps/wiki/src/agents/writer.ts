import path from "node:path"
import fs from "node:fs/promises"

import { prompts } from "@/prompts"
import { LLMFactory } from "@/llm/llm.factory"
import { createAgent } from "langchain"
import { fileSystemMCP } from "@/mcp/filesystem"
import { ExplorerOutput } from "@/schemas/explorer.schema"

const MAX_RETRIES = 2

interface SectionResult {
	title: string
	content: string
	success: boolean
}

class WriterAgent {
	async run(repoPath: string, explorerOutput: ExplorerOutput): Promise<void> {
		console.log("Running Writer Agent with MCP...")

		const mcpClient = fileSystemMCP.getClient(repoPath)

		try {
			const tools = await mcpClient.getTools()

			console.log("[DEBUG] Tools count:", tools.length)
			console.log("[DEBUG] Tool 0 type:", typeof tools[0])
			console.log("[DEBUG] Tool 0 name:", "name" in tools[0] ? (tools[0] as { name: string }).name : "unknown")
			console.log("[DEBUG] Tool 0 keys:", Object.keys(tools[0]))

			const llm = LLMFactory.createWriterModel()
			const agent = createAgent({ model: llm, tools })

			for (let i = 0; i < explorerOutput.sections.length; i++) {
				const section = explorerOutput.sections[i]
				console.log(
					`  Generating section ${i + 1}/${explorerOutput.sections.length}: ${section.title}`
				)
				console.log(`  [DEBUG] Section files:`, section.files || "NO FILES")

				const result = await this.generateSection(agent, section, explorerOutput)

				if (result.success) {
					await this.saveSection(repoPath, i + 1, section.title, result.content)
				} else {
					console.error(`  ❌ Failed to generate section: ${section.title}`)
				}
			}
		} finally {
			await mcpClient.close()
		}

		console.log("Writer completed")
	}

	private async generateSection(
		agent: ReturnType<typeof createAgent>,
		section: { title: string; description: string; files?: string[] },
		explorerOutput: ExplorerOutput
	): Promise<SectionResult> {
		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			try {
				const prompt = await prompts.get("section-mcp", {
					section_title: section.title,
					section_description: section.description,
					section_files: (section.files || []).join("\n"),
					project_overview: explorerOutput.overview,
					project_features: explorerOutput.features.join(", "),
				})

				const response = (await agent.invoke({
					messages: [{ role: "user", content: prompt }],
				})) as { messages: Array<{ type?: string; content: unknown; tool_calls?: Array<{ name: string; args: unknown }> }> }

				this.logToolCalls(response.messages)

				const lastMessage = response.messages[response.messages.length - 1]
				const content = lastMessage?.content
				const contentStr = Array.isArray(content)
					? content.map(c => (typeof c === "string" ? c : c.text)).join("")
					: String(content)

				const cleanContent = this.cleanOutput(contentStr)

				console.log(`  Section generated: ${section.title}`)
				return { title: section.title, content: cleanContent, success: true }
			} catch (error) {
				console.warn(`  Attempt ${attempt + 1} failed for ${section.title}:`, error)
			}
		}

		return { title: section.title, content: "", success: false }
	}

	private cleanOutput(output: string): string {
		let cleaned = output.trim()

		cleaned = cleaned.replace(/^```markdown\n?/, "")
		cleaned = cleaned.replace(/^```\n?$/, "")
		cleaned = cleaned.replace(/```$/, "")

		cleaned = cleaned.replace(/<thought>.+<\/thought>/g, "")

		const thinkBlockPattern = /<thought>[\s\S]*?<\/thought>/gi
		cleaned = cleaned.replace(thinkBlockPattern, "")

		const lines = cleaned.split("\n")
		const filteredLines = lines.filter(line => {
			const trimmed = line.trim()
			return !trimmed.match(/^\d+:\s/) && trimmed !== ""
		})
		cleaned = filteredLines.join("\n")

		cleaned = cleaned.replace(/^#{1,6}\s+/, "")

		const firstHeaderIndex = cleaned.indexOf("## ")
		if (firstHeaderIndex > 0) {
			cleaned = cleaned.slice(firstHeaderIndex)
		}

		cleaned = cleaned.trim()

		return cleaned
	}

	private logToolCalls(messages: Array<{ type?: string; content: unknown; tool_calls?: Array<{ name: string; args: unknown }> }>): void {
		console.log("  [DEBUG] Total messages:", messages.length)

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i]
			const msgType = msg.type || `msg-${i}`

			if (msg.tool_calls && msg.tool_calls.length > 0) {
				console.log(`  [MCP Tool Call #${i}]:`, JSON.stringify(msg.tool_calls.map(tc => tc.name)))
			}
		}

		const allToolCalls: string[] = []
		for (const msg of messages) {
			if (msg.tool_calls) {
				for (const tc of msg.tool_calls) {
					allToolCalls.push(tc.name)
				}
			}
		}

		if (allToolCalls.length > 0) {
			console.log(`  [MCP Tools called]: ${allToolCalls.join(", ")}`)
		} else {
			console.log("  [MCP] No tools were called by the agent")
		}
	}

	private async saveSection(
		repoPath: string,
		index: number,
		title: string,
		content: string
	): Promise<void> {
		const slug = title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")

		const fileName = `${index.toString().padStart(2, "0")}-${slug}.md`
		const outputPath = path.join(
			repoPath,
			"..",
			"wiki_output",
			repoPath.split("/").pop() || "",
			fileName
		)

		await fs.mkdir(path.dirname(outputPath), { recursive: true })
		await fs.writeFile(outputPath, content, "utf-8")

		console.log(`  Saved: ${fileName}`)
	}
}

export const writerAgent = new WriterAgent()
