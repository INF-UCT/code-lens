import { join, relative } from "node:path"
import { readdir, readFile } from "node:fs/promises"

interface PromptVariables {
	[key: string]: string | number | boolean
}

class PromptHandler {
	private prompts: Map<string, string> = new Map()
	private configPath: string
	private loadPromise: Promise<void>

	constructor(configPath: string = join(process.cwd(), "config")) {
		this.configPath = configPath
		this.loadPromise = this.loadPrompts()
	}

	private async loadPrompts(): Promise<void> {
		const files = await this.scanDirectory(this.configPath)

		for (const filePath of files) {
			if (filePath.endsWith(".txt")) {
				const content = await readFile(filePath, "utf-8")
				const key = this.generateKey(filePath)
				this.prompts.set(key, content)
			}
		}
	}

	/**
	 * Genera la clave del prompt a partir del filepath
	 * Ejemplo: "config/planner/01.select-summary-files.txt" -> "select-summary-files"
	 * Ejemplo: "config/prompt.txt" -> "prompt"
	 */
	private generateKey(filePath: string): string {
		const relativePath = relative(this.configPath, filePath)
		const fileName = relativePath.split(/[/\\]/).pop() || ""

		return fileName.replace(/\.txt$/, "").replace(/^\d+\./, "")
	}

	async ready(): Promise<void> {
		await this.loadPromise
	}

	private async scanDirectory(dir: string): Promise<string[]> {
		const files: string[] = []
		const entries = await readdir(dir, { withFileTypes: true })

		for (const entry of entries) {
			const fullPath = join(dir, entry.name)
			if (entry.isDirectory()) {
				const subFiles = await this.scanDirectory(fullPath)
				files.push(...subFiles)
			} else if (entry.isFile()) {
				files.push(fullPath)
			}
		}

		return files
	}

	async get(key: string, variables?: PromptVariables): Promise<string> {
		await this.ready()
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

	getAvailablePrompts(): string[] {
		return Array.from(this.prompts.keys())
	}

	hasPrompt(key: string): boolean {
		return this.prompts.has(key)
	}
}

export const prompts = new PromptHandler()

export type { PromptVariables }
