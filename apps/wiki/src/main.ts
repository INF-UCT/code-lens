import { serve } from "@hono/node-server"
import { server } from "@/server"
import { vllmService } from "@/llm/vllm.service"

console.log("\nStarting Code Lens Wiki Service...\n")

await vllmService.checkConnection()

serve(server, info => {
	console.log(`[?] Server is running on PORT ${info.port}\n`)
})
