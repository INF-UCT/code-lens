import { prompts } from "@/prompts"
import { readFile } from "fs/promises"
import { existsSync } from "fs"
import { LLMFactory } from "@/llm/llm.factory"
import { DocGenerationInput } from "@/schemas/api.schema"
import { ContentLimiter } from "@/utils/content-limiter"

import { Section, SectionsGenSchema } from "@/schemas/sections.schema"

class PlannerAgent {
	public async run(input: DocGenerationInput) {
		const fileCount = input.flatTree.split("\n").filter(f => f.trim()).length
		const projectType = ContentLimiter.detectProjectType(input.flatTree.split("\n"))

		console.log("=".repeat(60))
		console.log("Starting planner agent")
		console.log(`Repository: ${input.repoId}`)
		console.log(`File count: ${fileCount}`)
		console.log(`Project type: ${projectType}`)
		console.log("=".repeat(60))

		const selectedFiles = await this.selectSummaryFiles(input)
		const summary = await this.writeSummary(input.repoPath, selectedFiles)

		const sections = await this.writeSections(input, summary, selectedFiles)

		console.log("=".repeat(60))
		console.log("Planner agent completed successfully")
		console.log(`Selected files: ${selectedFiles.length}`)
		console.log(`Summary length: ${summary.length} chars`)
		console.log(`Sections generated: ${sections.length}`)
		console.log("=".repeat(60))
	}

	async selectSummaryFiles(input: DocGenerationInput): Promise<string[]> {
		const allFiles = input.flatTree.split("\n").filter(f => f.trim())
		const fileCount = allFiles.length
		const adaptiveLimits = ContentLimiter.getAdaptiveLimits(fileCount)

		console.log(`\n--- FILE SELECTION PHASE ---`)
		console.log(`Total files in repository: ${fileCount}`)
		console.log(`Target files to select: 5-${adaptiveLimits.maxFiles}`)

		// Usar modelo específico optimizado
		const fileSelectorModel = LLMFactory.createFileSelectorModel()

		// Simplificar entrada para repos grandes
		const limitedFlatTree =
			fileCount > 500
				? allFiles.slice(0, 500).join("\n") + "\n... (more files omitted)"
				: input.flatTree

		const selectSummaryFilesPrompt = await prompts.get("select-summary-files", {
			flat_tree: limitedFlatTree,
		})

		try {
			const response = await fileSelectorModel.invoke([
				{ role: "user", content: selectSummaryFilesPrompt },
			])
			const content = response.content.toString().trim()

			console.log("LLM Response (first 200 chars):", content.substring(0, 200))
			console.log("LLM Response length:", content.length)

			// Intentar extraer archivos de la respuesta (JSON o texto)
			const extractedFiles = this.extractFilesFromResponse(
				content,
				allFiles,
				adaptiveLimits.maxFiles
			)

			if (extractedFiles.length > 0) {
				console.log(`✓ Extracted ${extractedFiles.length} files from LLM response`)
				console.log(`  Top 3: ${extractedFiles.slice(0, 3).join(", ")}`)
				return extractedFiles
			}

			throw new Error("No valid files extracted from LLM response")
		} catch (error) {
			console.error("✗ LLM selection failed:", error)
			console.warn("→ Using intelligent fallback selection")
			return this.getFallbackFiles(input.flatTree)
		}
	}

	/**
	 * Extrae rutas de archivos desde la respuesta del LLM
	 * Maneja tanto JSON válido como texto conversacional
	 */
	private extractFilesFromResponse(
		content: string,
		allFiles: string[],
		maxFiles: number
	): string[] {
		// Estrategia 1: Intentar parsear como JSON
		try {
			const parsed = this.parseJSONRobust(content)
			if (parsed && Array.isArray(parsed.files)) {
				const rawFiles = (parsed.files as string[])
					.filter(f => typeof f === "string" && f.length > 0)
					.slice(0, maxFiles)

				// Validar y normalizar rutas
				const validatedFiles = this.validateAndNormalizeFilePaths(rawFiles, allFiles)

				if (validatedFiles.length > 0) {
					console.log("  → Extracted from JSON structure")
					console.log(
						`  → Validated ${validatedFiles.length}/${rawFiles.length} files`
					)
					return validatedFiles
				}
			}
		} catch {
			// JSON parsing falló, continuar con estrategias alternativas
		}

		// Estrategia 2: Extraer rutas de archivos del texto usando regex
		// Buscar patrones comunes de rutas de archivos
		const filePatterns = [
			// Rutas entre comillas
			/["']([a-zA-Z0-9_.\-/]+\.[a-zA-Z0-9]+)["']/g,
			// Rutas sin comillas pero con extensiones comunes
			/\b([a-zA-Z0-9_.\-/]+\.(ts|js|json|md|yml|yaml|toml|rs|go|py|php|java|cs|dockerfile|txt|lock))\b/gi,
			// Archivos específicos importantes
			/\b(README\.md|package\.json|Cargo\.toml|go\.mod|pyproject\.toml|composer\.json|Dockerfile|docker-compose\.yml)\b/gi,
		]

		const extractedPaths = new Set<string>()

		for (const pattern of filePatterns) {
			const matches = content.matchAll(pattern)
			for (const match of matches) {
				const path = match[1] || match[0]
				extractedPaths.add(path)
			}
		}

		// Validar las rutas extraídas
		const validatedFiles = this.validateAndNormalizeFilePaths(
			Array.from(extractedPaths),
			allFiles
		)

		const result = validatedFiles.slice(0, maxFiles)

		if (result.length > 0) {
			console.log("  → Extracted from conversational text using regex")
			console.log(`  → Validated ${result.length}/${extractedPaths.size} paths`)
		}

		return result
	}

	/**
	 * Valida y normaliza rutas de archivos
	 * Maneja rutas parciales buscando coincidencias en el repositorio
	 */
	private validateAndNormalizeFilePaths(
		paths: string[],
		allFiles: string[]
	): string[] {
		const validated: string[] = []
		const notFound: string[] = []

		for (const path of paths) {
			// Caso 1: Ruta exacta existe
			if (allFiles.includes(path)) {
				validated.push(path)
				continue
			}

			// Caso 2: Ruta parcial - buscar coincidencias
			const candidates = allFiles.filter(
				f => f.endsWith("/" + path) || f.endsWith(path)
			)

			if (candidates.length === 1) {
				// Solo una coincidencia - usarla
				validated.push(candidates[0])
			} else if (candidates.length > 1) {
				// Múltiples coincidencias - priorizar las más relevantes
				// Preferir rutas más cortas (menos anidadas) y ciertas ubicaciones
				const prioritized = candidates.sort((a, b) => {
					// Prioridad 1: Archivos en raíz o nivel superior
					const aDepth = a.split("/").length
					const bDepth = b.split("/").length
					if (aDepth !== bDepth) return aDepth - bDepth

					// Prioridad 2: Directorios importantes (backend, src, app)
					const importantDirs = ["backend", "src", "app", "server"]
					const aHasImportant = importantDirs.some(dir => a.includes(dir))
					const bHasImportant = importantDirs.some(dir => b.includes(dir))
					if (aHasImportant && !bHasImportant) return -1
					if (!aHasImportant && bHasImportant) return 1

					// Prioridad 3: Alfabético
					return a.localeCompare(b)
				})

				validated.push(prioritized[0])
			} else {
				// No se encontró el archivo
				notFound.push(path)
			}
		}

		// Logging detallado - primero los exitosos, luego los no encontrados
		if (validated.length > 0) {
			console.log(`  ✓ Validated ${validated.length}/${paths.length} files:`)
			validated.slice(0, 5).forEach(f => console.log(`    - ${f}`))
			if (validated.length > 5) {
				console.log(`    ... and ${validated.length - 5} more`)
			}
		}

		if (notFound.length > 0) {
			console.warn(`  ⚠ ${notFound.length} files not found in repository:`)
			notFound.slice(0, 3).forEach(f => console.warn(`    - ${f}`))
			if (notFound.length > 3) {
				console.warn(`    ... and ${notFound.length - 3} more`)
			}
		}

		return validated
	}

	/**
	 * Extrae un resumen desde la respuesta del LLM
	 * Maneja tanto JSON válido como texto conversacional
	 */
	private extractSummaryFromResponse(content: string): string | null {
		// Estrategia 1: Intentar parsear como JSON
		try {
			const parsed = this.parseJSONRobust(content)
			if (parsed) {
				// Caso 1: summary es un string (formato correcto)
				if (typeof parsed.summary === "string") {
					const summary =
						parsed.summary.length > 500
							? parsed.summary.substring(0, 497) + "..."
							: parsed.summary
					console.log("  → Extracted from JSON structure (string)")
					return summary
				}

				// Caso 2: summary es un objeto (LLM generó estructura compleja)
				if (typeof parsed.summary === "object" && parsed.summary !== null) {
					// Convertir el objeto a una descripción textual
					const summaryObj = parsed.summary as Record<string, unknown>
					const summaryParts: string[] = []

					// Extraer información útil del objeto
					if (summaryObj.description && typeof summaryObj.description === "string") {
						summaryParts.push(summaryObj.description)
					}
					if (summaryObj.purpose && typeof summaryObj.purpose === "string") {
						summaryParts.push(summaryObj.purpose)
					}

					// Si hay tecnologías, agregarlas
					if (summaryObj.technologies) {
						const techStr = JSON.stringify(summaryObj.technologies)
						summaryParts.push(`Technologies: ${techStr}`)
					}

					if (summaryParts.length > 0) {
						const summary = summaryParts.join(". ").substring(0, 500)
						console.log("  → Extracted from JSON structure (object converted)")
						return summary
					}
				}
			}
		} catch {
			// JSON parsing falló, continuar con estrategias alternativas
		}

		// Estrategia 2: Buscar texto descriptivo relevante
		// El LLM a veces genera descripciones útiles aunque no estén en JSON
		const lines = content.split("\n").filter(l => l.trim())

		// Buscar líneas que parecen descripciones técnicas del proyecto
		const descriptiveLines = lines.filter(line => {
			const lower = line.toLowerCase()
			// Filtrar líneas que parecen metadata o explicaciones del proceso
			if (lower.includes("alright") || lower.includes("i'm trying")) return false
			if (lower.includes("help the user") || lower.includes("complete")) return false
			if (lower.startsWith("{") || lower.startsWith("[")) return false
			// Buscar líneas que mencionen tech stack o propósito
			return (
				lower.includes("project") ||
				lower.includes("application") ||
				lower.includes("api") ||
				lower.includes("service") ||
				lower.includes("framework") ||
				lower.includes("uses") ||
				lower.includes("built with") ||
				lower.includes("typescript") ||
				lower.includes("javascript") ||
				lower.includes("python") ||
				lower.includes("rust") ||
				lower.includes("go") ||
				lower.includes("java") ||
				line.length > 50
			)
		})

		if (descriptiveLines.length > 0) {
			// Tomar las primeras 2-3 oraciones descriptivas
			const summary = descriptiveLines.slice(0, 3).join(" ").substring(0, 500)
			if (summary.length > 30) {
				console.log("  → Extracted descriptive text from conversational response")
				return summary
			}
		}

		// Estrategia 3: Extraer cualquier texto entre comillas que parezca un resumen
		const quotedTextMatch = content.match(/"([^"]{30,500})"/)
		if (quotedTextMatch) {
			console.log("  → Extracted quoted text as summary")
			return quotedTextMatch[1]
		}

		return null
	}

	/**
	 * Selección de emergencia si el LLM falla
	 * Usa un sistema de priorización inteligente
	 */
	private getFallbackFiles(flatTree: string): string[] {
		const allFiles = flatTree.split("\n").filter(f => f.trim())

		// Obtener límites adaptativos según tamaño del repo
		const limits = ContentLimiter.getAdaptiveLimits(allFiles.length)
		const maxFiles = limits.maxFiles

		console.log(
			`Repo size: ${allFiles.length} files, using adaptive max: ${maxFiles}`
		)

		// Sistema de priorización con pesos
		type FilePriority = { path: string; score: number }
		const prioritized: FilePriority[] = []

		// Patrones críticos (peso alto)
		const criticalPatterns = [
			{ pattern: /^README\.md$/i, score: 100 },
			{ pattern: /^package\.json$/i, score: 95 },
			{ pattern: /^pyproject\.toml$/i, score: 95 },
			{ pattern: /^Cargo\.toml$/i, score: 95 },
			{ pattern: /^go\.mod$/i, score: 95 },
			{ pattern: /^composer\.json$/i, score: 95 },
			{ pattern: /^pom\.xml$/i, score: 95 },
			{ pattern: /^build\.gradle$/i, score: 90 },
		]

		// Patrones importantes (peso medio)
		const importantPatterns = [
			{ pattern: /\/README\.md$/i, score: 80 },
			{ pattern: /^docker-compose\.ya?ml$/i, score: 75 },
			{ pattern: /^Dockerfile$/i, score: 70 },
			{ pattern: /\.ya?ml$/i, score: 50 }, // CI/CD configs
			{ pattern: /main\.[a-z]+$/i, score: 85 },
			{ pattern: /index\.[a-z]+$/i, score: 85 },
			{ pattern: /app\.[a-z]+$/i, score: 80 },
			{ pattern: /server\.[a-z]+$/i, score: 75 },
			{ pattern: /config\.[a-z]+$/i, score: 60 },
		]

		// Patrones secundarios (peso bajo)
		const secondaryPatterns = [
			{ pattern: /^LICENSE$/i, score: 30 },
			{ pattern: /^CONTRIBUTING\.md$/i, score: 40 },
			{ pattern: /\.env\.example$/i, score: 45 },
			{ pattern: /^schema\./i, score: 55 },
			{ pattern: /^makefile$/i, score: 35 },
		]

		// Calcular scores para todos los archivos
		for (const file of allFiles) {
			let score = 0

			// Aplicar patrones críticos
			for (const { pattern, score: patternScore } of criticalPatterns) {
				if (pattern.test(file)) {
					score = Math.max(score, patternScore)
				}
			}

			// Aplicar patrones importantes
			for (const { pattern, score: patternScore } of importantPatterns) {
				if (pattern.test(file)) {
					score = Math.max(score, patternScore)
				}
			}

			// Aplicar patrones secundarios
			for (const { pattern, score: patternScore } of secondaryPatterns) {
				if (pattern.test(file)) {
					score = Math.max(score, patternScore)
				}
			}

			// Bonus por profundidad (archivos en raíz son más importantes)
			const depth = (file.match(/\//g) || []).length
			if (depth === 0) score += 20
			else if (depth === 1) score += 10
			else if (depth === 2) score += 5

			// Penalización por archivos en carpetas de dependencias/builds
			if (/node_modules|vendor|dist|build|target|\.git/i.test(file)) {
				score = 0
			}

			if (score > 0) {
				prioritized.push({ path: file, score })
			}
		}

		// Ordenar por score descendente y tomar los mejores
		prioritized.sort((a, b) => b.score - a.score)
		const selected = prioritized.slice(0, maxFiles).map(f => f.path)

		console.log(
			`Fallback seleccionó ${selected.length} archivos con sistema de priorización`
		)
		if (selected.length > 0) {
			console.log(`Top 3 archivos: ${selected.slice(0, 3).join(", ")}`)
		}

		return selected
	}

	async writeSummary(repoPath: string, files: string[]): Promise<string> {
		console.log(`\n--- SUMMARY GENERATION PHASE ---`)
		console.log(`Files to process: ${files.length}`)

		const plannerModel = LLMFactory.createPlannerModel()

		const relevantFilesContent = await this.formatRelevantFiles(repoPath, files)

		const estimatedTokens = ContentLimiter.estimateTokens(relevantFilesContent)
		console.log(`Content prepared: ~${estimatedTokens} tokens`)

		const writeSummaryPrompt = await prompts.get("write-summary", {
			project_files_content: relevantFilesContent,
		})

		try {
			const response = await plannerModel.invoke([
				{ role: "user", content: writeSummaryPrompt },
			])
			const content = response.content.toString().trim()

			console.log("LLM Response (first 200 chars):", content.substring(0, 200))
			console.log("LLM Response length:", content.length)

			// Intentar extraer summary de la respuesta (JSON o texto)
			const extractedSummary = this.extractSummaryFromResponse(content)

			if (extractedSummary) {
				console.log(`✓ Summary generated: ${extractedSummary.length} chars`)
				console.log(`  Preview: ${extractedSummary.substring(0, 80)}...`)
				return extractedSummary
			}

			throw new Error("No valid summary extracted from LLM response")
		} catch (error) {
			console.error("✗ Summary generation failed:", error)
			console.warn("→ Using fallback summary generator")
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

	/**
	 * Genera secciones básicas cuando el LLM falla
	 */
	private generateFallbackSections(files: string[], summary: string): Section[] {
		console.log("Generating fallback sections based on file structure")

		const sections: Section[] = []

		// Agrupar archivos por categoría
		const configFiles = files.filter(f =>
			/package\.json|cargo\.toml|pyproject\.toml|go\.mod|composer\.json|pom\.xml/i.test(
				f
			)
		)
		const readmeFiles = files.filter(f => /readme/i.test(f))
		const sourceFiles = files.filter(f => /src\/|app\//i.test(f))
		const testFiles = files.filter(f => /test|spec/i.test(f))
		const dockerFiles = files.filter(f => /docker|\.yml$/i.test(f))

		// Sección general
		if (readmeFiles.length > 0 || configFiles.length > 0) {
			sections.push({
				title: "Configuración General",
				keyFiles: [...readmeFiles, ...configFiles].slice(0, 5),
				tinySummary:
					"Documentación principal y archivos de configuración del proyecto",
			})
		}

		// Sección de código fuente
		if (sourceFiles.length > 0) {
			sections.push({
				title: "Código Fuente",
				keyFiles: sourceFiles.slice(0, 5),
				tinySummary: "Archivos principales de implementación del proyecto",
			})
		}

		// Sección de tests
		if (testFiles.length > 0) {
			sections.push({
				title: "Tests",
				keyFiles: testFiles.slice(0, 5),
				tinySummary: "Archivos de pruebas y testing",
			})
		}

		// Sección de Docker/CI
		if (dockerFiles.length > 0) {
			sections.push({
				title: "Infraestructura",
				keyFiles: dockerFiles.slice(0, 5),
				tinySummary: "Configuración de Docker y CI/CD",
			})
		}

		// Si no pudimos generar secciones específicas, crear una general
		if (sections.length === 0) {
			sections.push({
				title: "Proyecto",
				keyFiles: files.slice(0, 8),
				tinySummary: summary.substring(0, 100),
			})
		}

		console.log(`✓ Fallback generated ${sections.length} sections`)
		return sections
	}

	async writeSections(
		repoInfo: DocGenerationInput,
		summary: string,
		selectedFiles: string[]
	): Promise<Section[]> {
		// Usar modelo específico con tokens limitados para evitar respuestas enormes
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
			80 // Reducido a 80 líneas para evitar sobrecarga
		)

		// CRÍTICO: Enviar solo los archivos seleccionados, NO toda la lista plana
		// Esto evita que el LLM intente incluir todos los archivos del repo
		const selectedFilesList = selectedFiles.join("\n")

		console.log(`Árbol jerárquico: ${simplifiedTree.split("\n").length} líneas`)
		console.log(`Archivos seleccionados: ${selectedFiles.length}`)

		const writeSummaryPrompt = await prompts.get("write-sections", {
			project_summary: summary,
			hierarchy_tree: simplifiedTree,
			flat_file_list: selectedFilesList, // Solo archivos importantes
		})

		console.log(
			`Sections input size: ~${ContentLimiter.estimateTokens(writeSummaryPrompt)} tokens`
		)

		const message = {
			role: "user",
			content: writeSummaryPrompt,
		}

		try {
			const { sections } = await structuredModel.invoke([message])

			// Validar y limpiar las secciones
			const validatedSections = sections.map(section => ({
				...section,
				// Limitar a máximo 8 archivos por sección
				keyFiles: section.keyFiles.slice(0, 8),
			}))

			console.log(`✓ Generated ${validatedSections.length} sections`)
			validatedSections.forEach((s, i) => {
				console.log(`  ${i + 1}. ${s.title} (${s.keyFiles.length} files)`)
			})

			return validatedSections
		} catch (error) {
			console.error("✗ Section generation failed:", error)
			// Fallback: generar secciones básicas basadas en estructura
			return this.generateFallbackSections(selectedFiles, summary)
		}
	}

	/**
	 * Parser JSON robusto que intenta reparar JSON truncado o mal formado
	 * y extraer JSON de texto conversacional
	 */
	private parseJSONRobust(content: string): { [key: string]: unknown } | null {
		try {
			// Limpiar el contenido
			let cleaned = content.trim()

			// Eliminar markdown code blocks si existen
			cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/, "")
			cleaned = cleaned.trim()

			// Limpiar comas finales comunes que genera el LLM
			// Caso 1: ["item1", "item2",]
			cleaned = cleaned.replace(/,\s*\]/g, "]")
			// Caso 2: {"key": "value",}
			cleaned = cleaned.replace(/,\s*\}/g, "}")
			// Caso 3: espacios múltiples entre elementos
			cleaned = cleaned.replace(/\s+/g, " ")

			// Intentar parsear directamente primero
			try {
				return JSON.parse(cleaned) as { [key: string]: unknown }
			} catch {
				// Si falla, buscar JSON dentro del texto

				// 1. Buscar el primer '{' que podría ser el inicio del JSON
				const jsonStart = cleaned.indexOf("{")
				if (jsonStart === -1) {
					// No hay JSON, usar fallback regex (no es un error, es esperado)
					return null
				}

				// 2. Extraer desde el primer '{' hasta el final
				cleaned = cleaned.substring(jsonStart)

				// 3. Intentar encontrar el JSON válido completo
				// Contar llaves para encontrar dónde termina el objeto principal
				let openBraces = 0
				let openBrackets = 0
				let inString = false
				let jsonEnd = -1
				let escapeNext = false

				for (let i = 0; i < cleaned.length; i++) {
					const char = cleaned[i]

					if (escapeNext) {
						escapeNext = false
						continue
					}

					if (char === "\\") {
						escapeNext = true
						continue
					}

					if (char === '"' && !escapeNext) {
						inString = !inString
						continue
					}

					if (!inString) {
						if (char === "{") openBraces++
						if (char === "}") {
							openBraces--
							// Si llegamos a 0, encontramos el final del objeto principal
							if (openBraces === 0) {
								jsonEnd = i + 1
								break
							}
						}
						if (char === "[") openBrackets++
						if (char === "]") openBrackets--
					}
				}

				// Si encontramos un final válido, extraer solo esa parte
				if (jsonEnd > 0) {
					cleaned = cleaned.substring(0, jsonEnd)
				} else {
					// Si no encontramos final, intentar cerrar estructuras
					// Cerrar strings abiertas
					if (inString) {
						cleaned += '"'
					}

					// Cerrar estructuras abiertas
					while (openBrackets > 0) {
						cleaned += "]"
						openBrackets--
					}
					while (openBraces > 0) {
						cleaned += "}"
						openBraces--
					}
				}

				// Intentar parsear de nuevo
				try {
					return JSON.parse(cleaned) as { [key: string]: unknown }
				} catch {
					// JSON reparación falló - fallback regex se encargará
					return null
				}
			}
		} catch {
			// Error crítico - fallback regex se encargará
			return null
		}
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
				console.warn(`Archivo no encontrado: ${filePath}`)
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

		// Detectar tamaño del repositorio usando la cantidad de archivos seleccionados
		// como indicador (ajustamos basado en cuántos archivos se eligieron)
		const estimatedRepoSize = files.length * 20 // Estimación heurística
		const adaptiveLimits = ContentLimiter.getAdaptiveLimits(estimatedRepoSize)

		console.log(
			`Adaptive limits: maxFiles=${adaptiveLimits.maxFiles}, maxChars/file=${adaptiveLimits.maxCharsPerFile}, total=${adaptiveLimits.maxTotalChars}`
		)

		// Aplicar límites inteligentes
		const limitedFiles = ContentLimiter.limitFileContents(
			fileContents,
			adaptiveLimits
		)

		// Formatear el contenido
		let result = ""

		for (const file of limitedFiles) {
			result += `### ${file.path}`

			if (file.truncated) {
				result += " [File truncated to fit limits]"
			}

			result += "\n"
			result += `${file.content}\n`
			result += "---\n"
		}

		const truncatedCount = limitedFiles.filter(f => f.truncated).length
		const totalTokens = ContentLimiter.estimateTokens(result)

		console.log(
			`Files processed: ${limitedFiles.length}/${fileContents.length} (${truncatedCount} truncated)`
		)
		console.log(`Total content tokens: ~${totalTokens}`)

		return result
	}
}

export const plannerAgent = new PlannerAgent()
