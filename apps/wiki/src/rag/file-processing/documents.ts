import { Language } from "@/rag/file-processing/languages"
import { ClassifiedFile, ContentKind } from "@/rag/file-processing/classifier"
import logger from "@/utils/logger"

import { CSVLoader } from "@langchain/community/document_loaders/fs/csv"
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base"
import { Document as LangChainDocument } from "@langchain/core/documents"

type LoaderFactory = (file: ClassifiedFile) => BaseDocumentLoader

export type DocumentMetadata = {
	projectId: string
	source: string
	absoluteSource?: string
	kind: ContentKind
	language: Language | "none"
	fileName: string
	extension: string
	chunkIndex?: number
	startLine?: number
	endLine?: number
}

export type Document = LangChainDocument<DocumentMetadata>

export class DocumentProcessor {
	private static loaderMatcher: Record<ContentKind, LoaderFactory> = {
		csv: file => new CSVLoader(file.path),
		text: file => new TextLoader(file.path),
		code: file => new TextLoader(file.path),
		markdown: file => new TextLoader(file.path),
	}

	public static async loadFile(file: ClassifiedFile): Promise<Document[]> {
		const loader = DocumentProcessor.loaderMatcher[file.kind](file)
		const documents = (await loader.load()) as Document[]

		for (const document of documents) {
			document.metadata = {
				...document.metadata,
				projectId: file.projectId,
				kind: file.kind,
				language: file.language,
				source: file.relativePath,
				absoluteSource: file.path,
				fileName: file.name,
				extension: file.extension,
				chunkIndex: document.metadata.chunkIndex,
			}
		}

		return documents
	}

	public static async loadFiles(files: ClassifiedFile[]): Promise<Document[]> {
		const allDocuments: Document[] = []

		for (const file of files) {
			try {
				const documents = await DocumentProcessor.loadFile(file)
				allDocuments.push(...documents)
			} catch (error) {
				logger.warn(
					`[DocumentProcessor] Skipping unreadable file ${file.relativePath}: ${String(error)}`
				)
			}
		}

		return allDocuments
	}
}
