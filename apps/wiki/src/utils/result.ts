export type Result<T, E = string> =
	| { value: T; error: null }
	| { value: null; error: E }

export type PromiseResult<T, E = string> = Promise<Result<T, E>>

export const Ok = <T>(value: T): Result<T, never> => ({
	value,
	error: null,
})

export const Err = <E>(error: E): Result<never, E> => ({
	value: null,
	error,
})

export const safeAsyncTry = async <T>(
	promise: Promise<T>
): PromiseResult<T, string> => {
	try {
		const value = await promise
		return Ok(value)
	} catch (error) {
		return Err(errorToString(error))
	}
}

export const safeTry = <T>(fn: () => T): Result<T, string> => {
	try {
		return Ok(fn())
	} catch (error) {
		return Err(errorToString(error))
	}
}

const errorToString = (error: unknown): string => {
	if (error instanceof Error) {
		return `${error.name}: ${error.message}${
			error.stack ? `\nStack trace:\n${error.stack}` : ""
		}`
	}

	try {
		return `Unknown error: ${JSON.stringify(error)}`
	} catch {
		return "Unknown error"
	}
}
