import env from "@/env"
import logger from "./logger"

import type { Context, Next } from "hono"

import { Hono } from "hono"
import { explorerAgent } from "@/agents/explorer"
import { writerAgent } from "@/agents/writer"
import { DocGenerationDto, DocGenerationInput } from "@/schemas/api.schema"
import { fileSystemMCP } from "@/mcp/filesystem"
import { LLMFactory } from "@/llm/llm.factory"
import { createAgent } from "langchain"

const app = new Hono()

const apiKeyAuth = async (c: Context, next: Next) => {
	const authHeader = c.req.header("Authorization")

	if (!authHeader) {
		return c.json({ error: "Missing Authorization header" }, 401)
	}

	const token = authHeader.replace("Bearer ", "")

	if (token !== env.WIKI_SERVICE_API_KEY) {
		return c.json({ error: "Invalid API key" }, 401)
	}

	await next()
}

app.post("/docs-gen", apiKeyAuth, async c => {
	const body = await c.req.json<DocGenerationInput>()
	await DocGenerationDto.parseAsync(body)

	logger.info(`Repository ID: ${body.repoId}`)
	logger.info(`Repository Path: ${body.repoPath}`)

	const explorerOutput = await explorerAgent.run(body)

	await writerAgent.run(body.repoPath, explorerOutput)

	return c.json({
		repo_id: body.repoId,
		message: "Documentation generated successfully",
	})
})

app.post("/test-mcp", async c => {
	const body = await c.req.json<{ repoPath: string; filePath: string }>()
	const { repoPath, filePath } = body

	logger.info(`Testing MCP read for: ${filePath}`)

	const mcpClient = fileSystemMCP.getClient(repoPath)

	try {
		const tools = await mcpClient.getTools()
		const readTool = tools.find(t => "name" in t && t.name === "read_file")

		if (!readTool) {
			return c.json(
				{
					error: "read_file tool not found",
					availableTools: tools.map(t => ("name" in t ? t.name : "unknown")),
				},
				500
			)
		}

		logger.info(`Calling read_file tool for: ${filePath}`)
		const result = await readTool.invoke({ path: filePath })

		logger.info(`Tool result:`, result)

		return c.json({
			filePath,
			content: result,
			tool: "read_file",
		})
	} finally {
		await mcpClient.close()
	}
})

app.post("/test-mcp-agent", async c => {
	const body = await c.req.json<{ repoPath: string; question?: string }>()
	const { repoPath, question } = body

	logger.info(`Testing MCP Agent...`)
	logger.info(`Repo path: ${repoPath}`)

	const mcpClient = fileSystemMCP.getClient(repoPath)

	try {
		const tools = await mcpClient.getTools()

		logger.info(`[DEBUG] Tools count: ${tools.length}`)
		logger.info(`[DEBUG] Tool 0 type: ${typeof tools[0]}`)
		if (tools.length > 0) {
			const firstTool = tools[0] as unknown as { name?: string; function?: unknown }
			logger.info(`[DEBUG] Tool 0 name property: ${firstTool.name}`)
			logger.info(`[DEBUG] Tool 0 function: ${JSON.stringify(firstTool.function)}`)
		}

		const llm = LLMFactory.createWriterModel()
		const agent = createAgent({ model: llm, tools })

		const testQuestion = question || "List the files in the root directory of this repository. Use the available tools."

		logger.info(`Invoking agent with question: ${testQuestion}`)

		const response = (await agent.invoke({
			messages: [{ role: "user", content: testQuestion }],
		})) as { messages: Array<{ type?: string; content: unknown; tool_calls?: Array<{ name: string; args: unknown }> }> }

		logger.info(`[DEBUG] Response messages count: ${response.messages.length}`)

		for (let i = 0; i < response.messages.length; i++) {
			const msg = response.messages[i]
			logger.info(`[DEBUG] Message ${i} type: ${msg.type}`)
			if (msg.tool_calls && msg.tool_calls.length > 0) {
				logger.info(`[DEBUG] Tool calls in message ${i}:`, JSON.stringify(msg.tool_calls.map(tc => tc.name)))
			}
		}

		const lastMessage = response.messages[response.messages.length - 1]
		const content = lastMessage?.content
		const contentStr = Array.isArray(content)
			? content.map(c => (typeof c === "string" ? c : (c as { text: string }).text)).join("")
			: String(content)

		return c.json({
			question: testQuestion,
			toolsCount: tools.length,
			toolsNames: tools.map(t => ("name" in t ? t.name : "unknown")),
			response: contentStr,
			messagesCount: response.messages.length,
			hasToolCalls: response.messages.some(m => m.tool_calls && m.tool_calls.length > 0),
		})
	} finally {
		await mcpClient.close()
	}
})

app.post("/test-mcp-writer-prompt", async c => {
	const body = await c.req.json<{ repoPath: string; sectionTitle: string; sectionDescription: string; files: string[] }>()
	const { repoPath, sectionTitle, sectionDescription, files } = body

	logger.info(`Testing MCP Agent with writer prompt...`)

	const mcpClient = fileSystemMCP.getClient(repoPath)

	try {
		const tools = await mcpClient.getTools()
		const llm = LLMFactory.createWriterModel()
		const agent = createAgent({ model: llm, tools })

		const prompt = `YOUR TASK:
1. Use read_file tool to read EVERY file listed in "Files to analyze" below
2. After reading all files, generate documentation based ONLY on what you read

Section: ${sectionTitle}
Description: ${sectionDescription}

Files to analyze:
${files.join("\n")}

CRITICAL: You MUST use the read_file tool to read these files. If you do not read them, you will make up false code and fail.`

		logger.info(`[TEST] Prompt: ${prompt}`)

		const response = (await agent.invoke({
			messages: [{ role: "user", content: prompt }],
		})) as { messages: Array<{ type?: string; content: unknown; tool_calls?: Array<{ name: string; args: unknown }> }> }

		logger.info(`[DEBUG] Response messages count: ${response.messages.length}`)

		for (let i = 0; i < response.messages.length; i++) {
			const msg = response.messages[i]
			if (msg.tool_calls && msg.tool_calls.length > 0) {
				logger.info(`[DEBUG] Tool calls in message ${i}:`, JSON.stringify(msg.tool_calls.map(tc => tc.name)))
			}
		}

		const hasToolCalls = response.messages.some(m => m.tool_calls && m.tool_calls.length > 0)

		return c.json({
			sectionTitle,
			filesCount: files.length,
			hasToolCalls,
			messagesCount: response.messages.length,
		})
	} finally {
		await mcpClient.close()
	}
})

export const server = {
	fetch: app.fetch,
	port: 3000,
}
