import fg from "fast-glob"
import logger from "@/utils/logger"
import { WikiPage } from "@/agents/planner/schemas"

import { QdrantService } from "./qdrant"
import { ClassifiedFile } from "./file-processing/classifier"
import { DocumentChunker } from "./file-processing/chunker"
import { DocumentProcessor } from "./file-processing/documents"

export type RetrievedChunk = {
	content: string
	source: string
	kind: string
	language: string
	chunkIndex: number
	startLine?: number
	endLine?: number
	score: number
}

type RetrieveContextInput = {
	projectId: string
	sectionTitle: string
	page: WikiPage
	topK?: number
	maxChunks?: number
	maxPerFile?: number
}

type RankedChunk = RetrievedChunk & {
	rankScore: number
}

type ChunkMetadata = {
	source?: string
	kind?: string
	language?: string
	chunkIndex?: number
	startLine?: number
	endLine?: number
}

class RagEngine {
	constructor(private qdrantService: QdrantService) {}

	public static async create(): Promise<RagEngine> {
		const qdrantService = await QdrantService.create()
		return new RagEngine(qdrantService)
	}

	public async newIndexation(projectId: string, projectPath: string) {
		logger.info(`Cleaning existing vectors for project ${projectId}...`)
		await this.qdrantService.deleteProjectVectors(projectId)

		const files = await fg(`${projectPath}/**/*`, {
			absolute: true,
			onlyFiles: true,
		})

		const classifiedFiles = files.map(
			file => new ClassifiedFile(file, projectId, projectPath)
		)
		const documents = await DocumentProcessor.loadFiles(classifiedFiles)
		const chunkedDocuments = await DocumentChunker.chunk(documents)

		if (chunkedDocuments.length === 0) {
			logger.warn(`No chunks generated for project ${projectId}`)
			return
		}

		logger.info(`Storing ${chunkedDocuments.length} documents in Qdrant...`)

		await this.qdrantService.store.addDocuments(chunkedDocuments)
	}

	public async retrievePageContext(input: RetrieveContextInput): Promise<RetrievedChunk[]> {
		const query = this.buildQuery(input.sectionTitle, input.page)
		const topK = input.topK ?? 40
		const maxChunks = input.maxChunks ?? 14
		const maxPerFile = input.maxPerFile ?? 3

		const scoredDocuments = await this.qdrantService.searchByProject(
			query,
			input.projectId,
			topK
		)

		const retrievedChunks = scoredDocuments.map(([document, score]) => {
			const metadata = (document.metadata ?? {}) as ChunkMetadata

			return {
				content: document.pageContent,
				source: this.normalizePath(metadata.source),
				kind: metadata.kind ?? "text",
				language: metadata.language ?? "none",
				chunkIndex: metadata.chunkIndex ?? 0,
				startLine: metadata.startLine,
				endLine: metadata.endLine,
				score,
			}
		})

		const rankedChunks = this.rankChunks(retrievedChunks, input.page.relevant_files)
		const uniqueChunks = this.dedupeChunks(rankedChunks)
		const selectedChunks = this.limitByFile(uniqueChunks, maxPerFile).slice(0, maxChunks)

		logger.info(
			`Retrieved ${selectedChunks.length} context chunks for page ${input.page.id}`
		)

		return selectedChunks
	}

	private buildQuery(sectionTitle: string, page: WikiPage): string {
		const relevantFiles = page.relevant_files.join("\n")

		return [
			`Section: ${sectionTitle}`,
			`Page title: ${page.title}`,
			`Page description: ${page.description}`,
			`Relevant files:\n${relevantFiles}`,
		].join("\n\n")
	}

	private rankChunks(chunks: RetrievedChunk[], relevantFiles: string[]): RankedChunk[] {
		const relevantPaths = new Set(relevantFiles.map(file => this.normalizePath(file)))

		return chunks
			.map(chunk => {
				const source = this.normalizePath(chunk.source)
				const isRelevant = relevantPaths.has(source)
				const relevanceBoost = isRelevant ? 0.15 : 0

				return {
					...chunk,
					rankScore: chunk.score + relevanceBoost,
				}
			})
			.sort((a, b) => b.rankScore - a.rankScore)
	}

	private dedupeChunks(chunks: RankedChunk[]): RankedChunk[] {
		const seen = new Set<string>()
		const unique: RankedChunk[] = []

		for (const chunk of chunks) {
			const key = `${chunk.source}:${chunk.chunkIndex}:${chunk.startLine}:${chunk.endLine}`

			if (seen.has(key)) continue
			seen.add(key)
			unique.push(chunk)
		}

		return unique
	}

	private limitByFile(chunks: RankedChunk[], maxPerFile: number): RankedChunk[] {
		const fileCounter = new Map<string, number>()
		const selected: RankedChunk[] = []

		for (const chunk of chunks) {
			const count = fileCounter.get(chunk.source) ?? 0
			if (count >= maxPerFile) continue

			fileCounter.set(chunk.source, count + 1)
			selected.push(chunk)
		}

		return selected
	}

	private normalizePath(path: string | undefined): string {
		if (!path) return "unknown"
		return path.replaceAll("\\\\", "/").trim()
	}
}

export const rag = await RagEngine.create()
