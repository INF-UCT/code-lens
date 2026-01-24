import process from "node:process"
import list from "./commands/list"
import login from "./commands/login"
import generate from "./commands/generate"

import { state } from "./state"
import { select } from "@clack/prompts"

const args = process.argv

const help = `
Code Lens CLI

This is the command line interface for Code Lens.

Login is required to access the features. You can login interactively or set the environment variables CODE_LENS_USERNAME and CODE_LENS_PASSWORD for automatic login.

Options:
  -h, --help  Show help

After logging in, you can run other commands with a interactive prompt.

Available commands after login:

1. Generate Code Lens Token for your project
2. List active Code Lens Tokens
3. Logout and Exit
`

export interface Command<T> {
	intro(): void
	ui(): Promise<T>
	run(data: T): Promise<void>
}

if (args.includes("--help") || args.includes("-h")) {
	console.log(help)
	process.exit(0)
}

if (!state.isLoggedIn()) {
	await login()
}

const command_selection = async () => {
	const opts = [
		{ label: "Generate new Code Lens Token for your project", value: generate },
		{ label: "List active Code Lens Tokens", value: list },
		{
			label: "Logout and Exit",
			value: async () => {
				state.clear()
				process.exit(0)
			},
		},
	]

	const selection = await select({
		message: "Select a command to execute",
		options: opts,
	})

	;(selection as () => Promise<void>)()
}

;(async () => {
	await command_selection()
})()
