import * as v from "valibot"

import env from "./env"
import type { Context, Next } from "hono"

import { Hono } from "hono"
import { DocGenerationDto, DocGenerationInput } from "./schemas/api.schema"

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
	await v.parseAsync(DocGenerationDto, body)

	console.log("Repo ID:", body.repo_id)
	console.log("Repo Path:", body.repo_path)
	console.log(`Flat Tree Length: \n ${body.flat_tree}\n`)
	console.log(`Hierarchy Tree Length: \n ${body.hierarchy_tree}\n`)

	return c.json({
		repo_id: body.repo_id,
		message: "Documentation generation request received",
	})
})

export const server = {
	fetch: app.fetch,
	port: 3000,
}
