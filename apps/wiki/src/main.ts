import { Hono } from "hono"
import { serve } from "@hono/node-server"
import type { Context, Next } from "hono"

import { DocGenerationBody } from "./schemas/sections.schema"

const API_KEY = process.env.WIKI_SERVICE_API_KEY

const app = new Hono()

const apiKeyAuth = async (c: Context, next: Next) => {
	const authHeader = c.req.header("Authorization")

	if (!API_KEY) {
		console.error("WIKI_SERVICE_API_KEY environment variable is not set")
		return c.json({ error: "Server configuration error" }, 500)
	}

	if (!authHeader) {
		return c.json({ error: "Missing Authorization header" }, 401)
	}

	const token = authHeader.replace("Bearer ", "")

	if (token !== API_KEY) {
		return c.json({ error: "Invalid API key" }, 401)
	}

	await next()
}

app.post("/docs-gen", apiKeyAuth, async c => {
	const body = await c.req.json<DocGenerationBody>()

	console.log("Received docs generation request:", body)
	console.log("Repo ID:", body.repo_id)
	console.log("Repo Path:", body.repo_path)
	console.log("File Tree Length:", body.file_tree.length)

	return c.json({
		message: "Documentation generation request received",
		repo_id: body.repo_id,
	})
})

const server = {
	fetch: app.fetch,
	port: 3000,
}

serve(server, info => {
	console.log(`Server is running on http://localhost:${info.port}`)
})
