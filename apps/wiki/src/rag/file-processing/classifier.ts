import path from "node:path"

import { Language, programmingExtensions } from "@/rag/file-processing/languages"

export type ContentKind = "code" | "text" | "csv" | "markdown"

export class ClassifiedFile {
	public kind: ContentKind
	public language: Language | "none"
	public extension: string
	public name: string
	public relativePath: string

	constructor(
		public path: string,
		public projectId: string,
		public repoRootPath: string
	) {
		const extension = ClassifiedFile.getFileExtension(path)

		this.extension = extension
		this.kind = ClassifiedFile.extensionToContentKind(extension)
		this.language = programmingExtensions.get(extension) ?? "none"
		this.name = ClassifiedFile.getFileName(path)
		this.relativePath = ClassifiedFile.getRelativePath(path, repoRootPath)
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

	static getFileName(filePath: string): string {
		return path.basename(filePath)
	}

	static getRelativePath(filePath: string, repoRootPath: string): string {
		const relativePath = path.relative(repoRootPath, filePath)
		return relativePath.split(path.sep).join("/")
	}
}
