import path from "node:path"

import { Language, programmingExtensions } from "@/rag/languages"

export type ContentKind = "code" | "text" | "csv" | "markdown"

export class ClassifiedFile {
	public kind: ContentKind
	public language?: Language
	public extension: string

	constructor(public path: string) {
		const extension = ClassifiedFile.getFileExtension(path)

		this.extension = extension
		this.kind = ClassifiedFile.extensionToContentKind(extension)
		this.language = programmingExtensions.get(extension)
	}

	static extensionToContentKind(extension: string): ContentKind {
		if (programmingExtensions.has(extension)) return "code"
		if (extension === "csv") return "csv"
		if (extension === "md") return "markdown"

		return "text"
	}

	static getFileExtension(filePath: string): string {
		const ext = path.extname(filePath).toLowerCase()
		return ext ? ext.slice(1) : "empty"
	}
}
