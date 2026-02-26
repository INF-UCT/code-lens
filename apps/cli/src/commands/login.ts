import { env } from "node:process"
import { request } from "@/api"
import { Command } from "@/main"
import { state, User, UserData } from "@/state"
import { intro, password as passwordInput, text, log } from "@clack/prompts"

interface LoginResponseData extends UserData {
	token: string
}

interface LoginInput {
	username: string
	password: string
}

class LoginCommand implements Command<LoginInput> {
	intro(): void {
		intro("Login to Code Lens CLI")
	}

	async ui(): Promise<LoginInput> {
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

	load_environment_variables(): LoginInput | null {
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
		const input = await this.ui()

		const response = await request<LoginResponseData>("/auth/login", {
			method: "POST",
			body: { username: input.username, password: input.password },
		})

		if (!response.success || !response.data) {
			log.error(
				`Login failed: ${response.message ?? "Unknown error. Try again later."}`
			)
			process.exit(1)
		}

		if (User.is(response.data)) {
			state.setUser(new User(response.data, response.data.token))
			log.success(`Logged in as ${response.data.username}`)
		}
	}

	static async execute() {
		await new LoginCommand().run()
	}
}

export default async () => LoginCommand.execute()
