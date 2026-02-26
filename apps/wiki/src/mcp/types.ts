import { ClientTool, ServerTool } from "@langchain/core/tools"

export type Tool = ServerTool | ClientTool
export type Tools = Tool[]
