import logger from "@/utils/logger"

import { Hono } from "hono"
import { ExplorerAgent } from "@/agents/explorer/agent"

import { apiKeyAuth } from "@/api/middleware"
import { DocGenerationDto, DocGenerationInput } from "@/api/schemas"

const app = new Hono()

app.post("/docs-gen", apiKeyAuth, async c => {
	const body = await c.req.json<DocGenerationInput>()
	await DocGenerationDto.parseAsync(body)

	logger.info(`Repository ID: ${body.repoId}`)
	logger.info(`Repository Path: ${body.repoPath}`)

	const explorerAgent = new ExplorerAgent(body.flatTree, body.repoPath)

	await explorerAgent.run().catch(error => {
		logger.error(`Error running ExplorerAgent: ${error}`)
	})

	// await writerAgent.run(body.repoPath, explorerOutput)

	return c.json({
		repo_id: body.repoId,
		message: "Documentation generated successfully",
	})
})

export const server = {
	fetch: app.fetch,
	port: 3000,
}
