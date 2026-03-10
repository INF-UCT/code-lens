import crypto from "node:crypto"

import {
	Language,
	languageToTextExplitterLanguage,
} from "@/rag/file-processing/languages"

import {
	TextSplitterParams,
	MarkdownTextSplitter,
	RecursiveCharacterTextSplitter as TextSplitter,
} from "@langchain/textsplitters"

import { Document } from "@/rag/file-processing/documents"
import { ContentKind } from "@/rag/file-processing/classifier"

type ExcludedCSV = Exclude<ContentKind, "csv">
type SplitterMatcher = Record<ExcludedCSV, SplitterFactory>
type SplitterFactory = (lang?: Language) => TextSplitter

const splitterOptions: Record<ExcludedCSV, Partial<TextSplitterParams>> = {
	markdown: {
		chunkSize: 1200,
		chunkOverlap: 150,
	},
	text: {
		chunkSize: 1000,
		chunkOverlap: 150,
	},
	code: {
		chunkSize: 800,
		chunkOverlap: 80,
	},
}

export class DocumentChunker {
	private static matcher: SplitterMatcher = {
		markdown: () => new MarkdownTextSplitter(splitterOptions.markdown),
		text: () => new TextSplitter(splitterOptions.text),
		code: lang => {
			if (!lang) return new TextSplitter(splitterOptions.code)

			return TextSplitter.fromLanguage(
				languageToTextExplitterLanguage[lang],
				splitterOptions.code
			)
		},
	}

	public static async chunk(documents: Document[]): Promise<Document[]> {
		const chunkedDocuments: Document[] = []

		for (const document of documents) {
			if (document.metadata.kind === "csv") {
				chunkedDocuments.push({
					...document,
					metadata: {
						...document.metadata,
						chunkIndex: document.metadata.chunkIndex ?? 0,
					},
				})
				continue
			}

			const splitter = DocumentChunker.getSplitter(document)
			const chunks = await splitter.splitDocuments([document])

			for (const [index, chunk] of chunks.entries()) {
				const loc = (
					chunk.metadata as {
						loc?: { lines?: { from?: number; to?: number } }
					}
				).loc

				const chunkMetadata = {
					...document.metadata,
					...chunk.metadata,
					chunkIndex: index,
					startLine: loc?.lines?.from,
					endLine: loc?.lines?.to,
				}

				const chunkId = DocumentChunker.generateChunkId()

				chunkedDocuments.push({ ...chunk, metadata: chunkMetadata, id: chunkId })
			}
		}

		return chunkedDocuments
	}

	private static generateChunkId(): string {
		return crypto.randomUUID()
	}

	private static getSplitter(doc: Document): TextSplitter {
		const factory = DocumentChunker.matcher[doc.metadata.kind as ExcludedCSV]
		return factory(doc.metadata.language as Language)
	}
}
