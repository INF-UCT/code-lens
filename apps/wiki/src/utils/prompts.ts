import fs from "node:fs"
import path from "node:path"

export interface PromptVariables {
	[key: string]: string | number | boolean
}

class PromptHandler {
	private prompts: Map<string, string> = new Map()
	private configPath: string

	constructor() {
		this.configPath = path.join(process.cwd(), "config")
		const files = this.scanDirectory(this.configPath)

		for (const filePath of files) {
			if (filePath.endsWith(".txt")) {
				const content = fs.readFileSync(filePath, { encoding: "utf-8" })
				const key = this.generateKey(filePath)

				this.prompts.set(key, content)
			}
		}
	}

	private generateKey(filePath: string): string {
		const relativePath = path.relative(this.configPath, filePath)

		const normalized = relativePath.replace(/\\/g, "/")
		const parts = normalized.split("/")

		const fileName = parts.pop() || ""
		const cleanedFileName = fileName.replace(/^\d+\./, "").replace(/\.txt$/, "")

		if (parts.length > 0) {
			return `${parts.join("/")}/${cleanedFileName}`
		}

		return cleanedFileName
	}

	private scanDirectory(dir: string): string[] {
		const files: string[] = []
		const entries = fs.readdirSync(dir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				const subFiles = this.scanDirectory(fullPath)
				files.push(...subFiles)
			} else if (entry.isFile()) {
				files.push(fullPath)
			}
		}

		return files
	}

	public get(key: string, variables?: PromptVariables): string {
		const template = this.prompts.get(key)

		if (!template) throw new Error(`Prompt not found: ${key}`)
		if (!variables) return template

		return this.interpolate(template, variables)
	}

	private interpolate(template: string, variables: PromptVariables): string {
		return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
			if (varName in variables) return String(variables[varName])
			return match
		})
	}
}

const prompts = new PromptHandler()

export default prompts
