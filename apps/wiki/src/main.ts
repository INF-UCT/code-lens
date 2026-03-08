import logger from "@/utils/logger"

import { serve } from "@hono/node-server"
import { server } from "@/api"
import { llmService } from "@/utils/llm"

await llmService.checkConnection()

serve(server, info => {
	logger.info(`Server is running on PORT ${info.port}`)
})
