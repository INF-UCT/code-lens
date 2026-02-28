import env from "@/utils/env"

type LogLevel = "debug" | "info" | "warn" | "error"
const logLevels: LogLevel[] = ["debug", "info", "warn", "error"]

const colors = {
	reset: "\x1b[0m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
}

class Logger {
	constructor(private logLevel: LogLevel) {}

	private shouldLog(level: LogLevel): boolean {
		return logLevels.indexOf(level) >= logLevels.indexOf(this.logLevel)
	}

	private prefix(level: LogLevel) {
		let color = colors.blue

		if (level === "error") color = colors.red
		if (level === "warn") color = colors.yellow
		if (level === "debug") color = colors.blue
		if (level === "info") color = colors.blue

		return ` ${color}${level.toUpperCase()}${colors.reset}`
	}

	public debug(...args: unknown[]) {
		if (this.shouldLog("debug")) {
			console.debug(this.prefix("debug"), ...args)
		}
	}

	public info(...args: unknown[]) {
		if (this.shouldLog("info")) {
			console.info(this.prefix("info"), ...args)
		}
	}

	public warn(...args: unknown[]) {
		if (this.shouldLog("warn")) {
			console.warn(this.prefix("warn"), ...args)
		}
	}

	public error(...args: unknown[]) {
		if (this.shouldLog("error")) {
			console.error(this.prefix("error"), ...args)
		}
	}
}

export default new Logger(env.LOG_LEVEL)
