import { MultiServerMCPClient } from "@langchain/mcp-adapters"

class FileSystemMCP {
	private command: string
	private args: string[]

	constructor() {
		this.command = "npx"
		this.args = ["-y", "@modelcontextprotocol/server-filesystem"]
	}

	getClient(path: string): MultiServerMCPClient {
		return new MultiServerMCPClient({
			filesystem: {
				command: this.command,
				args: [...this.args, path],
			},
		})
	}
}

export const fileSystemMCP = new FileSystemMCP()
