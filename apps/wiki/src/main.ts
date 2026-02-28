import logger from "@/utils/logger"

import { serve } from "@hono/node-server"
import { server } from "@/api"
import { vllmService } from "@/llm/vllm.service"

logger.info("Checking connection to VLLM Service...")

await vllmService.checkConnection()

serve(server, info => {
	logger.info(`Server is running on PORT ${info.port}`)
})
