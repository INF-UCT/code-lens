import { request } from "../api"
import { Command } from "../main"
import { state } from "../state"
import { intro, text, log } from "@clack/prompts"

type GenerateTokenData = {
	repository_url: string
}

class GenerateTokenCommand implements Command<GenerateTokenData> {
	intro(): void {
		intro("Code Lens Token Generation")
	}

	async ui(): Promise<GenerateTokenData> {
		this.intro()

		const repository_url = await text({
			message: "Repository URL",
			placeholder: "https://github.com/username/repo",
			validate(value) {
				if (value.length === 0) return `Value is required!`
				try {
					new URL(value)
				} catch {
					return "Could not parse URL. Please provide a valid URL."
				}
			},
		})

		return {
			repository_url: repository_url.toString().trim(),
		}
	}

	async run(): Promise<void> {
		const { repository_url } = await this.ui()

		const response = await request("/tokens/generate", {
			method: "POST",
			body: { user_id: state.getUser()!.id, repository_url },
		})

		if (response.success && response.data) {
			log.success(`Token generated successfully: ${response.data}`)
		}

		if (!response.success) {
			log.error(
				`Token generation failed: ${response.message ?? "Unknown error. Try again later."}`
			)

			process.exit(1)
		}
	}

	static async execute() {
		await new GenerateTokenCommand().run()
	}
}

export default async () => await GenerateTokenCommand.execute()
