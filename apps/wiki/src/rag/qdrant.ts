import env from "@/utils/env"

import { OpenAIEmbeddings } from "@langchain/openai"
import { QdrantVectorStore } from "@langchain/qdrant"

export class QdrantService {
	constructor(
		private embeddings: OpenAIEmbeddings,
		private store: QdrantVectorStore
	) {}

	public static async create(): Promise<QdrantService> {
		const embeddings = new OpenAIEmbeddings({
			model: "nomic-embed-text-v2-moe:latest",
			configuration: {
				baseURL: `${env.OLLAMA_URL}`,
				apiKey: "dummy",
			},
		})

		const qdrantOptions = {
			url: env.QDRANT_URL,
			collectionName: "wiki",
		}

		const store = await QdrantVectorStore.fromExistingCollection(
			embeddings,
			qdrantOptions
		)

		return new QdrantService(embeddings, store)
	}

	public getEmbeddings(): OpenAIEmbeddings {
		return this.embeddings
	}

	public getStore(): QdrantVectorStore {
		return this.store
	}
}
