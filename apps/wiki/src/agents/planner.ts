import { prompts } from "@/prompts"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { LLMFactory } from "@/llm/llm.factory"
import { DocGenerationInput } from "@/schemas/api.schema"
import { ContentLimiter } from "@/utils/content-limiter"

import {
	Section,
	SectionsGenSchema,
	SelectFilesSchema,
	SummaryGenSchema,
} from "@/schemas/sections.schema"

class PlannerAgent {
	public async run(input: DocGenerationInput) {
		console.log("Starting planner agent with input:", input)

		const selectedFiles = await this.selectSummaryFiles(input)
		const summary = await this.writeSummary(input.repoPath, selectedFiles)

		const sections = await this.writeSections(input, summary)

		console.log("Selected files for summary generation:", selectedFiles)
		console.log("Final summary for repository:", summary)

		console.log("Generated sections for documentation:", sections)
	}

	async selectSummaryFiles(input: DocGenerationInput): Promise<string[]> {
		// Usar modelo específico con tokens muy limitados
		const fileSelectorModel = LLMFactory.createFileSelectorModel()

		const structuredModel = fileSelectorModel.withStructuredOutput(
			SelectFilesSchema,
			{
				method: "jsonMode",
			}
		)

		const selectSummaryFilesPrompt = await prompts.get("select-summary-files", {
			flat_tree: input.flatTree,
			hierarchy_tree: input.hierarchyTree,
		})

		const message = {
			role: "user",
			content: selectSummaryFilesPrompt,
		}

		try {
			const { files } = await structuredModel.invoke([message])

			// Post-procesamiento: eliminar duplicados y limitar a 10
			const uniqueFiles = [...new Set(files)].slice(0, 10)

			console.log(`Archivos seleccionados: ${uniqueFiles.length}/${files.length}`)

			if (files.length !== uniqueFiles.length) {
				console.warn(
					`Se eliminaron ${files.length - uniqueFiles.length} archivos duplicados`
				)
			}

			return uniqueFiles
		} catch (error) {
			console.error("Error en selectSummaryFiles:", error)

			// Fallback: seleccionar archivos importantes manualmente
			console.warn("Usando selección de archivos por defecto (fallback)")
			return this.getFallbackFiles(input.flatTree)
		}
	}

	/**
	 * Selección de emergencia si el LLM falla
	 */
	private getFallbackFiles(flatTree: string): string[] {
		const allFiles = flatTree.split("\n").filter(f => f.trim())

		// Patrones de archivos importantes
		const patterns = [
			/README\.md$/i,
			/package\.json$/i,
			/pyproject\.toml$/i,
			/Cargo\.toml$/i,
			/composer\.json$/i,
			/go\.mod$/i,
			/pom\.xml$/i,
			/main\.[a-z]+$/i,
			/index\.[a-z]+$/i,
			/app\.[a-z]+$/i,
		]

		const selected = new Set<string>()

		for (const pattern of patterns) {
			for (const file of allFiles) {
				if (pattern.test(file) && selected.size < 10) {
					selected.add(file)
				}
			}
		}

		// Si no encontramos suficientes, agregar los primeros archivos
		if (selected.size < 5) {
			for (const file of allFiles.slice(0, 10)) {
				if (selected.size < 10) {
					selected.add(file)
				}
			}
		}

		console.log(`Fallback seleccionó ${selected.size} archivos`)
		return Array.from(selected)
	}

	async writeSummary(repoPath: string, files: string[]): Promise<string> {
		const plannerModel = LLMFactory.createPlannerModel()

		const structuredModel = plannerModel.withStructuredOutput(SummaryGenSchema, {
			method: "jsonMode",
		})

		const relevantFilesContent = await this.formatRelevantFiles(repoPath, files)

		console.log(
			`Summary input size: ~${ContentLimiter.estimateTokens(relevantFilesContent)} tokens`
		)

		const writeSummaryPrompt = await prompts.get("write-summary", {
			project_files_content: relevantFilesContent,
		})

		const message = {
			role: "user",
			content: writeSummaryPrompt,
		}

		try {
			const result = await structuredModel.invoke([message])

			// Validar que solo tenga el campo summary
			if (result && typeof result.summary === "string") {
				// Limitar longitud del summary (máximo 500 caracteres)
				const summary =
					result.summary.length > 500
						? result.summary.substring(0, 500) + "..."
						: result.summary

				console.log(`Summary generado: ${summary.length} caracteres`)
				return summary
			}

			// Si el resultado no es válido, usar fallback
			console.warn("Respuesta inválida del LLM, usando fallback")
			return this.generateFallbackSummary(files)
		} catch (error) {
			console.error("Error en writeSummary:", error)
			console.warn("Usando resumen por defecto (fallback)")
			return this.generateFallbackSummary(files)
		}
	}

	/**
	 * Genera un resumen básico basado en los nombres de archivos
	 */
	private generateFallbackSummary(files: string[]): string {
		const extensions = new Set<string>()
		const hasReadme = files.some(f => /readme/i.test(f))
		const hasPackageJson = files.some(f => /package\.json$/i.test(f))
		const hasPyprojectToml = files.some(f => /pyproject\.toml$/i.test(f))
		const hasCargoToml = files.some(f => /Cargo\.toml$/i.test(f))

		// Detectar extensiones
		for (const file of files) {
			const ext = file.split(".").pop()?.toLowerCase()
			if (ext) extensions.add(ext)
		}

		let summary = "This project"

		// Detectar tipo de proyecto
		if (hasPyprojectToml || extensions.has("py")) {
			summary += " is a Python application"
		} else if (hasPackageJson || extensions.has("ts") || extensions.has("js")) {
			summary += " is a JavaScript/TypeScript application"
		} else if (hasCargoToml || extensions.has("rs")) {
			summary += " is a Rust application"
		}

		if (hasReadme) {
			summary += " with documentation"
		}

		summary += ". Technologies detected: " + Array.from(extensions).join(", ") + "."

		console.log("Fallback summary generado")
		return summary
	}

	async writeSections(
		repoInfo: DocGenerationInput,
		summary: string
	): Promise<Section[]> {
		// Usar modelo específico con más tokens para secciones
		const sectionPlannerModel = LLMFactory.createSectionPlannerModel()

		const structuredModel = sectionPlannerModel.withStructuredOutput(
			SectionsGenSchema,
			{
				method: "jsonMode",
			}
		)

		// Simplificar el árbol jerárquico si es muy grande
		const simplifiedTree = ContentLimiter.simplifyTree(
			repoInfo.hierarchyTree,
			150 // Limitar a 150 líneas
		)

		// Limitar la lista plana si es muy larga
		const flatTreeLines = repoInfo.flatTree.split("\n")
		const limitedFlatTree =
			flatTreeLines.length > 500
				? flatTreeLines.slice(0, 500).join("\n") +
					"\n... [lista truncada, archivos omitidos]"
				: repoInfo.flatTree

		console.log(`Árbol jerárquico: ${simplifiedTree.split("\n").length} líneas`)
		console.log(`Lista plana: ${limitedFlatTree.split("\n").length} líneas`)

		const writeSummaryPrompt = await prompts.get("write-sections", {
			project_summary: summary,
			hierarchy_tree: simplifiedTree,
			flat_file_list: limitedFlatTree,
		})

		console.log(
			`Sections input size: ~${ContentLimiter.estimateTokens(writeSummaryPrompt)} tokens`
		)

		const message = {
			role: "user",
			content: writeSummaryPrompt,
		}

		const { sections } = await structuredModel.invoke([message])

		return sections
	}

	async formatRelevantFiles(repoPath: string, files: string[]): Promise<string> {
		// Leer todos los archivos
		const fileContents: Array<{ path: string; content: string }> = []

		for (const filePath of files) {
			const fullFilePath = `${repoPath}/${filePath}`
				.replace(/\/+/g, "/")
				.replace(/\/\.\//g, "/")
				.replace(/\/+$/g, "")

			if (!existsSync(fullFilePath)) {
				continue
			}

			try {
				const fileContent = await readFile(fullFilePath, "utf-8")
				fileContents.push({
					path: filePath,
					content: fileContent,
				})
			} catch (error) {
				console.warn(`No se pudo leer el archivo ${filePath}:`, error)
				continue
			}
		}

		// Aplicar límites inteligentes
		const limitedFiles = ContentLimiter.limitFileContents(fileContents, {
			maxCharsPerFile: 8000, // ~2000 tokens por archivo
			maxTotalChars: 50000, // ~12500 tokens total
			maxFiles: 10,
		})

		// Formatear el contenido
		let result = ""

		for (const file of limitedFiles) {
			result += `### ${file.path}`

			if (file.truncated) {
				result += " [Archivo truncado para ajustarse al límite]"
			}

			result += "\n"
			result += `${file.content}\n`
			result += "---\n"
		}

		console.log(`Archivos procesados: ${limitedFiles.length}/${fileContents.length}`)
		console.log(
			`Archivos truncados: ${limitedFiles.filter(f => f.truncated).length}`
		)

		return result
	}
}

export const plannerAgent = new PlannerAgent()
