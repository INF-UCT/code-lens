import { request } from "../api"
import { Command } from "../main"
import { state } from "../state"
import { intro, log } from "@clack/prompts"

interface Token {
	id: string
	user_id: string
	value: string
	repository_url: string
	created_at: string
}

class ListTokensCommand implements Command<void> {
	intro(): void {
		intro("List Active Code Lens Tokens")
	}

	async ui(): Promise<void> {
		this.intro()
	}

	async run(): Promise<void> {
		await this.ui()

		if (!state.getUser()) {
			log.error("User not logged in.")
			process.exit(1)
		}

		const response = await request(`/tokens/${state.getUser()!.id}`, {
			method: "GET",
		})

		if (response.success && response.data) {
			const tokens = response.data as Token[]
			if (tokens.length === 0) {
				log.info("No active tokens found.")
			} else {
				log.success("Active tokens:")
				tokens.forEach((token, index) => {
					log.message(`${index + 1}. Repository: ${token.repository_url}`)
					log.message(
						`   Created: ${new Date(token.created_at).toLocaleDateString()}`
					)
					log.message(`   Token: ${token.value}`)
					log.message("")
				})
			}
		}

		if (!response.success) {
			log.error(
				`Failed to list tokens: ${response.message ?? "Unknown error. Try again later."}`
			)

			process.exit(1)
		}
	}

	static async execute() {
		await new ListTokensCommand().run()
	}
}

export default async () => await ListTokensCommand.execute()
