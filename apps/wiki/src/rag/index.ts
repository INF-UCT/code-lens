import fg from "fast-glob"

import { QdrantService } from "./qdrant"
import { ClassifiedFile } from "./classifier"
import { DocumentLoader } from "./loaders/documents"
import logger from "@/utils/logger"

class RagEngine {
	constructor(private qdrantService: QdrantService) {}

	public static async create(): Promise<RagEngine> {
		const qdrantService = await QdrantService.create()
		return new RagEngine(qdrantService)
	}

	public async newIndexation(projectPath: string) {
		const files = await fg(`${projectPath}/**/*`, {
			absolute: true,
			onlyFiles: true,
		})

		const classifiedFiles = files.map(file => new ClassifiedFile(file))

		for (const classifiedFile of classifiedFiles) {
			const documents = await DocumentLoader.load(classifiedFile)

			logger.info(
				`[RAG Engine] - Loaded ${documents.length} documents from ${classifiedFile.path} (kind: ${classifiedFile.kind}, language: ${classifiedFile.language})`
			)
		}
	}
}

export const rag = await RagEngine.create()
