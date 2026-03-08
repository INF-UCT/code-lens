import { ChatOpenAI } from "@langchain/openai"
import { HumanMessage } from "langchain"
import { PromiseResult } from "@/utils/result"

export abstract class Agent<T> {
	constructor(protected readonly llm: ChatOpenAI) {}
	public abstract run(): PromiseResult<T>
}

export class AgentInvokeBuilder {
	private messages: HumanMessage[] = []
	private recursionLimit: number = 100

	withPrompt(message: string): this {
		this.messages.push(new HumanMessage(message))
		return this
	}

	withRecursionLimit(limit: number): this {
		this.recursionLimit = limit
		return this
	}

	build(): [{ messages: HumanMessage[] }, { recursionLimit: number }] {
		return [{ messages: this.messages }, { recursionLimit: this.recursionLimit }]
	}
}
