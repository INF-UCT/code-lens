export type RequestOptions = {
	method: "GET" | "POST" | "PUT" | "DELETE"
	body?: unknown
	authorization?: string
}

export type Response<T, E, R> = {
	status: number
	success: boolean
	message: string
	data?: T | null
	error?: E | null
	errors?: R | null
}

type RequestResult<T, E, R> = Promise<Response<T, E, R>>

export const request = async <T, E = unknown, R = unknown>(
	route: string,
	opts: RequestOptions
): RequestResult<T, E, R> => {
	const headers: Record<string, string> = {
		"Accept": "application/json",
		"Content-Type": "application/json",
	}

	if (opts.authorization) {
		headers["Authorization"] = opts.authorization
	}

	const url = `http://localhost/api${route}`
	try {
		const response = await fetch(url, {
			method: opts.method,
			headers,
			body: opts.body ? JSON.stringify(opts.body) : undefined,
		})

		const data = await response.json()

		return {
			status: response.status,
			success: response.ok,
			message: data.message ?? "",
			data: response.ok ? data : null,
			error: !response.ok ? data : null,
			errors: !response.ok ? data : null,
		}
	} catch (error) {
		return {
			status: 500,
			success: false,
			message: "Internal Server Error",
			data: null,
			error: error as E,
			errors: null,
		}
	}
}
