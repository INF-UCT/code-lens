import { env } from "node:process"
import { request } from "../api"
import { Command } from "../main"
import { state, User, UserData } from "../state"
import { intro, password as passwordInput, text, log } from "@clack/prompts"

interface LoginData {
	username: string
	password: string
}

class LoginCommand implements Command<LoginData> {
	intro(): void {
		intro("Login to Code Lens CLI")
	}

	async ui(): Promise<LoginData> {
		this.intro()

		const env_credentials = this.load_environment_variables()

		if (env_credentials) {
			log.info("Using credentials from environment variables.")
			return env_credentials
		}

		const username = await text({
			message: "Unique username (Hint: Your email prefix without year digits ;)",
			placeholder: "jdoe",
			validate(value) {
				if (value.length === 0) return `Value is required!`
			},
		})

		const password = await passwordInput({
			message: "Password",
			mask: "*",

			validate(value) {
				if (value.length === 0) return `Value is required!`
			},
		})

		return {
			username: username.toString(),
			password: password.toString(),
		}
	}

	load_environment_variables(): LoginData | null {
		const username = env["CODE_LENS_USERNAME"]
		const password = env["CODE_LENS_PASSWORD"]

		if (username && password) {
			return {
				username: username.toString(),
				password: password.toString(),
			}
		}

		return null
	}

	async run(): Promise<void> {
		const { username, password } = await this.ui()

		const response = await request<UserData>("/auth/login", {
			method: "POST",
			body: { username, password },
		})

		if (response.success && response.data && User.is(response.data)) {
			state.setUser(new User(response.data))
		}

		if (!response.success) {
			log.error(
				`Login failed: ${response.message ?? "Unknown error. Try again later."}`
			)

			process.exit(1)
		}
	}

	static async execute() {
		await new LoginCommand().run()
	}
}

export default async () => LoginCommand.execute()
