import { ASTLoader } from "@/rag/loaders/ast"
import { ClassifiedFile, ContentKind } from "@/rag/classifier"

import { CSVLoader } from "@langchain/community/document_loaders/fs/csv"
import { TextLoader } from "@langchain/classic/document_loaders/fs/text"
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base"
import { Document as LangChainDocument } from "@langchain/core/documents"

type LoaderFactory = (file: ClassifiedFile) => BaseDocumentLoader

export type DocumentMetadata = {
	source: string
	kind: ContentKind
	language?: string
}

export type Document = LangChainDocument<DocumentMetadata>

export class DocumentLoader {
	private static matcher: Record<ContentKind, LoaderFactory> = {
		csv: file => new CSVLoader(file.path),
		text: file => new TextLoader(file.path),
		markdown: file => new TextLoader(file.path),
		code: file => new ASTLoader(file.path, file.language!),
	}

	public static async load(file: ClassifiedFile): Promise<Document[]> {
		const loader = DocumentLoader.matcher[file.kind](file)
		const documents = (await loader.load()) as Document[]

		for (const document of documents) {
			document.metadata = {
				...document.metadata,
				kind: file.kind,
				language: file.language,
			}
		}

		return documents
	}
}
