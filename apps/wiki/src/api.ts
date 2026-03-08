import z from "zod"
import env from "@/utils/env"
import logger from "@/utils/logger"

import type { Context, Next } from "hono"

import { rag } from "@/rag"
import { Hono } from "hono"
import { PlannerAgent } from "@/agents/planner/agent"

const app = new Hono()

const DocGenerationDto = z.object({
	repoId: z.string().uuid(),
	repoPath: z.string().nonempty(),
	repoTree: z.string().nonempty(),
})

type DocGenerationInput = z.infer<typeof DocGenerationDto>

export const apiKeyAuth = async (c: Context, next: Next) => {
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
	logger.info(`Repository Tree\n: ${body.repoTree}`)

	const plannerAgent = new PlannerAgent(body.repoPath, body.repoTree)

	const plannerOutput = await plannerAgent.run().catch(error => {
		logger.error(`Error running PlannerAgent: ${error}`)
		return undefined
	})

	if (!plannerOutput) return c.status(500)

	logger.info(`[API] Planner output: ${JSON.stringify(plannerOutput, null, 2)}`)

	await rag.newIndexation(body.repoPath)

	return c.json({
		repo_id: body.repoId,
		message: "Documentation generated successfully",
	})
})

export const server = {
	fetch: app.fetch,
	port: 3000,
}
