import { Document } from "@/rag/loaders/documents"
import { AST_LANGUAGES, Language } from "@/rag/languages"
import { BaseDocumentLoader } from "@langchain/core/document_loaders/base"

import fs from "node:fs/promises"
import Parser from "tree-sitter"
import { Err, Ok, PromiseResult, safeAsyncTry } from "@/utils/result"
import logger from "@/utils/logger"

export class ASTLoader extends BaseDocumentLoader {
	constructor(
		public filePath: string,
		public language: Language
	) {
		super()
	}

	public async load(): Promise<Document[]> {
		const parser = new Parser()
		const treeSitterLanguage = AST_LANGUAGES[this.language]

		if (!treeSitterLanguage) {
			throw new Error(`Unsupported language: ${this.language}`)
		}

		parser.setLanguage(treeSitterLanguage)

		const { value, error } = await this.readFileContent()

		if (error) {
			logger.error(`[AST Loader] - Error reading file ${this.filePath}: ${error}`)
			return []
		}

		const code = value!
		const tree = parser.parse(code)
		const rootNode = tree.rootNode

		logger.info(
			`[AST Loader] - Successfully parsed ${this.filePath} with language ${this.language}`
		)

		return []
	}

	private async readFileContent(): PromiseResult<string> {
		const { value: content, error } = await safeAsyncTry(
			fs.readFile(this.filePath, "utf-8")
		)

		if (error) return Err(`Failed to read file ${this.filePath}: ${error}`)

		return Ok(content!)
	}
}
