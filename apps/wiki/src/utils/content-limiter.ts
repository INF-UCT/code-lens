/**
 * Utilidad para limitar y gestionar el contenido enviado a LLMs
 * Previene errores de límite de contexto en proyectos grandes
 */

interface ContentLimits {
	maxCharsPerFile: number
	maxTotalChars: number
	maxFiles: number
}

export class ContentLimiter {
	// Límites conservadores basados en modelos típicos
	// ~4 caracteres por token, dejando espacio para el prompt y respuesta
	private static readonly DEFAULT_LIMITS: ContentLimits = {
		maxCharsPerFile: 8000, // ~2000 tokens por archivo
		maxTotalChars: 50000, // ~12500 tokens total para contenido
		maxFiles: 10,
	}

	/**
	 * Trunca el contenido de un archivo de manera inteligente
	 * Prioriza el inicio y fin del archivo
	 */
	static truncateFile(content: string, maxChars: number): string {
		if (content.length <= maxChars) {
			return content
		}

		// Estrategia: tomar inicio y fin del archivo
		const headerSize = Math.floor(maxChars * 0.6) // 60% del inicio
		const footerSize = Math.floor(maxChars * 0.3) // 30% del final
		// 10% restante para el marcador de truncamiento

		const header = content.substring(0, headerSize)
		const footer = content.substring(content.length - footerSize)

		const truncationMarker = `\n\n... [Contenido truncado: ${content.length - maxChars} caracteres omitidos] ...\n\n`

		return header + truncationMarker + footer
	}

	/**
	 * Limita un array de archivos según las restricciones de tokens
	 * Trunca archivos individuales y limita el total
	 */
	static limitFileContents(
		files: Array<{ path: string; content: string }>,
		limits: Partial<ContentLimits> = {}
	): Array<{ path: string; content: string; truncated: boolean }> {
		const activeeLimits = { ...this.DEFAULT_LIMITS, ...limits }

		let totalChars = 0
		const result: Array<{ path: string; content: string; truncated: boolean }> = []

		for (const file of files) {
			// Verificar si alcanzamos el límite de archivos
			if (result.length >= activeeLimits.maxFiles) {
				break
			}

			// Truncar archivo individual si es necesario
			const originalLength = file.content.length
			let content = file.content

			if (content.length > activeeLimits.maxCharsPerFile) {
				content = this.truncateFile(content, activeeLimits.maxCharsPerFile)
			}

			// Verificar límite total
			if (totalChars + content.length > activeeLimits.maxTotalChars) {
				// Calcular cuánto espacio queda
				const remainingSpace = activeeLimits.maxTotalChars - totalChars

				if (remainingSpace > 1000) {
					// Solo incluir si quedan al menos 1000 caracteres
					content = this.truncateFile(content, remainingSpace)
					result.push({
						path: file.path,
						content,
						truncated: true,
					})
					totalChars += content.length
				}
				break
			}

			result.push({
				path: file.path,
				content,
				truncated: originalLength !== content.length,
			})

			totalChars += content.length
		}

		return result
	}

	/**
	 * Simplifica un árbol jerárquico para reducir su tamaño
	 * Limita la profundidad y agrupa archivos en carpetas
	 */
	static simplifyTree(tree: string, maxLines: number = 150): string {
		const lines = tree.split("\n")

		if (lines.length <= maxLines) {
			return tree
		}

		// Estrategia: mantener estructura principal, omitir detalles profundos
		const result: string[] = []
		const maxDepth = 4 // Limitar profundidad del árbol

		for (let i = 0; i < lines.length && result.length < maxLines; i++) {
			const line = lines[i]
			const indent = line.search(/\S/)

			// Calcular profundidad (asumiendo 2 espacios por nivel)
			const depth = Math.floor(indent / 2)

			if (depth <= maxDepth) {
				result.push(line)
			} else if (depth === maxDepth + 1) {
				// Agregar indicador de contenido omitido
				if (result[result.length - 1] !== "  ...") {
					result.push(`${"  ".repeat(maxDepth)}... [más archivos]`)
				}
			}
		}

		if (lines.length > result.length) {
			result.push("\n... [estructura truncada]")
		}

		return result.join("\n")
	}

	/**
	 * Calcula un estimado aproximado de tokens
	 * Regla heurística: ~4 caracteres = 1 token
	 */
	static estimateTokens(text: string): number {
		return Math.ceil(text.length / 4)
	}

	/**
	 * Divide archivos en lotes para procesamiento por partes
	 * Útil si se necesita procesar muchos archivos en múltiples llamadas
	 */
	static batchFiles<T>(items: T[], batchSize: number): T[][] {
		const batches: T[][] = []

		for (let i = 0; i < items.length; i += batchSize) {
			batches.push(items.slice(i, i + batchSize))
		}

		return batches
	}
}
