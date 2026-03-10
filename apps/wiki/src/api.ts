import z from "zod"
import env from "@/utils/env"
import logger from "@/utils/logger"

import type { Context, Next } from "hono"

import { rag } from "@/rag"
import { Hono } from "hono"
import { PlannerAgent } from "@/agents/planner/agent"
import { DocumentationGenerator } from "@/docs/generator"

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
	logger.info(`Repository Tree entries: ${body.repoTree.split("\n").length}`)

	const plannerAgent = new PlannerAgent(body.repoPath, body.repoTree)

	logger.info(`[API] Running PlannerAgent for repo ${body.repoId}...`)

	const plannerOutput = await plannerAgent.run().catch(error => {
		logger.error(`Error running PlannerAgent: ${error}`)
		return undefined
	})

	if (!plannerOutput) return c.status(500)
	if (plannerOutput.error) {
		logger.error(
			`[API] Planner failed for repo ${body.repoId}: ${plannerOutput.error}`
		)
		return c.json({ error: plannerOutput.error }, 500)
	}

	logger.info(
		`[API] Planner summary: sections=${plannerOutput.value!.sections.length}, pages=${plannerOutput.value!.pages.length}`
	)

	logger.info(`[API] Reindexing repository ${body.repoId} in Qdrant...`)
	await rag.newIndexation(body.repoId, body.repoPath)

	logger.info(`[API] Generating markdown documentation for repo ${body.repoId}...`)
	const docsGenerator = new DocumentationGenerator()
	const generationResult = await docsGenerator.generate({
		repoId: body.repoId,
		plannerOutput: plannerOutput.value!,
	})

	const hasErrors = generationResult.errors.length > 0

	if (hasErrors) {
		logger.warn(
			`[API] Documentation generated with partial errors for repo ${body.repoId}: ${generationResult.errors.length} pages failed`
		)
	}

	return c.json({
		repo_id: body.repoId,
		message: hasErrors
			? "Documentation generated with partial failures"
			: "Documentation generated successfully",
		generated_pages: generationResult.generatedPages,
		output_path: generationResult.outputDir,
		errors: generationResult.errors,
	})
})

export const server = {
	fetch: app.fetch,
	port: 3000,
}
