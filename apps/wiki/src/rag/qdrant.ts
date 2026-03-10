import env from "@/utils/env"

import { OpenAIEmbeddings } from "@langchain/openai"
import { QdrantVectorStore } from "@langchain/qdrant"
import { Document } from "@langchain/core/documents"

type QdrantSearchFilter = {
	must: Array<{
		key: string
		match: {
			value: string
		}
	}>
}

type QdrantDeleteRequest = {
	filter: QdrantSearchFilter
}

type ScoredDocument = [Document, number]

export class QdrantService {
	private static readonly collectionName = "wiki"

	constructor(
		public store: QdrantVectorStore,
		private embeddings: OpenAIEmbeddings
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
			collectionName: QdrantService.collectionName,
		}

		const store = await QdrantVectorStore.fromExistingCollection(
			embeddings,
			qdrantOptions
		)

		return new QdrantService(store, embeddings)
	}

	public getEmbeddings(): OpenAIEmbeddings {
		return this.embeddings
	}

	public async searchByProject(
		query: string,
		projectId: string,
		topK: number
	): Promise<ScoredDocument[]> {
		const filter = this.buildProjectFilter(projectId)

		return await this.store.similaritySearchWithScore(query, topK, filter)
	}

	public async deleteProjectVectors(projectId: string): Promise<void> {
		const body: QdrantDeleteRequest = {
			filter: this.buildProjectFilter(projectId),
		}

		const response = await fetch(
			`${env.QDRANT_URL}/collections/${QdrantService.collectionName}/points/delete?wait=true`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			}
		)

		if (!response.ok) {
			const errorBody = await response.text()
			throw new Error(
				`Failed to delete vectors for project ${projectId}. Qdrant response (${response.status}): ${errorBody}`
			)
		}
	}

	private buildProjectFilter(projectId: string): QdrantSearchFilter {
		return {
			must: [
				{
					key: "metadata.projectId",
					match: {
						value: projectId,
					},
				},
			],
		}
	}
}
