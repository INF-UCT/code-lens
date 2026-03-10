// @ts-expect-error - package has no types
import ProtocolBuffers from "tree-sitter-proto"

import Parser from "tree-sitter"
import JavaScript from "tree-sitter-javascript"
import TypeScript from "tree-sitter-typescript"
import Python from "tree-sitter-python"
import Go from "tree-sitter-go"
import Java from "tree-sitter-java"
import C from "tree-sitter-c"
import CPP from "tree-sitter-cpp"
import Rust from "tree-sitter-rust"

import { SupportedTextSplitterLanguage } from "@langchain/textsplitters"

export type Language =
	| "JavaScript"
	| "TypeScript"
	| "TypeScript-React"
	| "JavaScript-React"
	| "Python"
	| "Go"
	| "Java"
	| "C"
	| "C++"
	| "Rust"
	| "Protocol-Buffers"

export const programmingExtensions = new Map<string, Language>([
	["js", "JavaScript"],
	["ts", "TypeScript"],
	["tsx", "TypeScript-React"],
	["jsx", "JavaScript-React"],
	["py", "Python"],
	["go", "Go"],
	["java", "Java"],
	["c", "C"],
	["h", "C"],
	["cpp", "C++"],
	["hpp", "C++"],
	["rs", "Rust"],
	["proto", "Protocol-Buffers"],
])

export const languageToTextExplitterLanguage: Record<
	Language,
	SupportedTextSplitterLanguage
> = {
	"JavaScript": "js",
	"TypeScript": "js",
	"TypeScript-React": "js",
	"JavaScript-React": "js",
	"Python": "python",
	"Go": "go",
	"Java": "java",
	"C": "cpp",
	"C++": "cpp",
	"Rust": "rust",
	"Protocol-Buffers": "proto",
}

type TSLanguage = Parameters<Parser["setLanguage"]>[0]

export const AST_LANGUAGES: Record<Language, TSLanguage> = {
	"JavaScript": JavaScript as TSLanguage,
	"TypeScript": TypeScript.typescript as TSLanguage,
	"TypeScript-React": TypeScript.tsx as TSLanguage,
	"JavaScript-React": JavaScript as TSLanguage,
	"Python": Python as TSLanguage,
	"Go": Go as TSLanguage,
	"Java": Java as TSLanguage,
	"C": C as TSLanguage,
	"C++": CPP as TSLanguage,
	"Rust": Rust as TSLanguage,
	"Protocol-Buffers": ProtocolBuffers as TSLanguage,
}
