import logger from "@/utils/logger"

import { Hono } from "hono"
import { ExplorerAgent } from "@/agents/explorer/agent"

import { apiKeyAuth } from "@/api/middleware"
import { DocGenerationDto, DocGenerationInput } from "@/api/schemas"
import { PlannerAgent } from "@/agents/planner/agent"

const app = new Hono()

app.post("/docs-gen", apiKeyAuth, async c => {
	const body = await c.req.json<DocGenerationInput>()
	await DocGenerationDto.parseAsync(body)

	logger.info(`Repository ID: ${body.repoId}`)
	logger.info(`Repository Path: ${body.repoPath}`)

	const explorerAgent = new ExplorerAgent(body.repoPath)

	const explorerOutput = await explorerAgent.run().catch(error => {
		logger.error(`Error running ExplorerAgent: ${error}`)
		return undefined
	})

	if (!explorerOutput) {
		return c.json(
			{ error: "Failed to analyze repository", repo_id: body.repoId },
			500
		)
	}

	const plannerAgent = new PlannerAgent(body.repoPath, explorerOutput)

	const plannerOutput = await plannerAgent.run().catch(error => {
		logger.error(`Error running PlannerAgent: ${error}`)
		return undefined
	})

	if (!plannerOutput) {
		return c.json(
			{ error: "Failed to generate documentation sections", repo_id: body.repoId },
			500
		)
	}

	logger.info(`[API] Planner output: ${JSON.stringify(plannerOutput, null, 2)}`)

	return c.json({
		repo_id: body.repoId,
		message: "Documentation sections generated successfully",
		sections_count: plannerOutput.sections.length,
	})
})

export const server = {
	fetch: app.fetch,
	port: 3000,
}
