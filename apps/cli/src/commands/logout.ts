import { request } from "@/api"
import { Command } from "@/main"
import { state } from "@/state"
import { intro, log } from "@clack/prompts"

class LogoutCommand implements Command<void> {
	intro(): void {
		intro("Logout from Code Lens CLI")
	}

	async ui(): Promise<void> {
		this.intro()
	}

	async run(): Promise<void> {
		const token = state.getToken()

		if (!token) {
			log.warn("You are not logged in.")
			return
		}

		const response = await request<{ message: string }>("/tokens/logout", {
			method: "POST",
			authorization: `Bearer ${token}`,
		})

		state.clear()

		if (response.success) {
			log.success("Logged out successfully")
		} else {
			log.warn(`Logout failed: ${response.message}`)
		}
	}

	static async execute() {
		await new LogoutCommand().run()
	}
}

export default async () => LogoutCommand.execute()
