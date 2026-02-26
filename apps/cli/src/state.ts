export type UserData = {
	id: string
	username: string
	email?: string
}

export class User {
	id: string
	username: string
	email: string
	token: string

	constructor(data: UserData, token: string) {
		this.id = data.id
		this.username = data.username
		this.email = data.email ?? ""
		this.token = token
	}

	static is(obj: object): obj is UserData & { token: string } {
		return (
			typeof (obj as UserData).id === "string" &&
			typeof (obj as UserData).username === "string" &&
			typeof (obj as { token: string }).token === "string"
		)
	}
}

export class State {
	private user: User | null = null

	setUser(user: User) {
		this.user = user
	}

	getUser(): User | null {
		return this.user
	}

	getToken(): string | null {
		return this.user?.token ?? null
	}

	isLoggedIn(): boolean {
		return this.user !== null
	}

	clear() {
		this.user = null
	}
}

export const state = new State()
