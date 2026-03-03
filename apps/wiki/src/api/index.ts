import logger from "@/utils/logger"

import { Hono } from "hono"
import { apiKeyAuth } from "@/api/middleware"
import { PlannerAgent } from "@/agents/planner/agent"
import { DocGenerationDto, DocGenerationInput } from "@/api/schemas"

const app = new Hono()

app.post("/docs-gen", apiKeyAuth, async c => {
	const body = await c.req.json<DocGenerationInput>()
	await DocGenerationDto.parseAsync(body)

	logger.info(`Repository ID: ${body.repoId}`)
	logger.info(`Repository Path: ${body.repoPath}`)
	logger.info(`Repository Tree\n: ${body.repoTree}`)

	const plannerAgent = new PlannerAgent(body.repoPath, body.repoTree)

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
		message: "Documentation generated successfully",
	})
})

export const server = {
	fetch: app.fetch,
	port: 3000,
}
