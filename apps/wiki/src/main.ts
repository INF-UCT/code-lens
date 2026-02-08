import { Hono } from "hono"
import { serve } from "@hono/node-server"

const app = new Hono()

interface DocGenerationBody {
	repo_id: string
	repo_path: string
}

app.post("/docs-gen", async c => {
	const body = await c.req.json<DocGenerationBody>()

	console.log("Received docs generation request:", body)
	console.log("Repo ID:", body.repo_id)
	console.log("Repo Path:", body.repo_path)

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
