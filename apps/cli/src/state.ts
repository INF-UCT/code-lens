export type UserData = {
	id: string
	username: string
}

export class User {
	id: string
	username: string

	constructor(data: UserData) {
		this.id = data.id
		this.username = data.username
	}

	static is(obj: object): obj is UserData {
		return (
			typeof (obj as UserData).id === "string" &&
			typeof (obj as UserData).username === "string"
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

	isLoggedIn(): boolean {
		return this.user !== null
	}

	clear() {
		this.user = null
	}
}

export const state = new State()
