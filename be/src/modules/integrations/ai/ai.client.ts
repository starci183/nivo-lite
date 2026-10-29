import { Document } from "@langchain/core/documents"
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages"
import type { BaseMessage } from "@langchain/core/messages"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { BaseRetriever } from "@langchain/core/retrievers"
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables"
import type { Runnable } from "@langchain/core/runnables"
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai"
import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import type {
    ChainReply,
    AiChatRequest,
    AiEmbedRequest,
    AiFetch,
    AiMessage,
    AiRunner,
    PassageSearch,
} from "./ai.contracts"
import { InjectAiEndpointOptions } from "./ai.decorators"
import type { AiEndpoint } from "./ai.options"
import { ANY_OBJECT } from "./ai.schema"
import { fieldOf, notesBlock, withNotes } from "./reply.policy"

/** The retriever over the domain search: the domain owns which lanes an agent may read, LangChain only wraps the call. */
class PassageRetriever extends BaseRetriever {
    lc_namespace = ["nivo", "retrievers", "passages"]

    constructor(
        private readonly search: PassageSearch,
        private readonly limit: number,
    ) {
        super()
    }

    override async _getRelevantDocuments(question: string): Promise<Array<Document>> {
        const found = await this.search(question)
        return found
            .slice(0, this.limit)
            .map((passage) => new Document({ pageContent: passage.content, metadata: { title: passage.title } }))
    }
}

const titleOf = (metadata: Record<string, unknown>): string | null =>
    typeof metadata.title === "string" ? metadata.title : null

const urlOf = (input: string | URL | Request): string => {
    if (typeof input === "string") return input
    return input instanceof URL ? input.href : input.url
}

const messageOf = (message: AiMessage): BaseMessage => {
    if (message.role === "system") return new SystemMessage(message.content)
    return message.role === "assistant" ? new AIMessage(message.content) : new HumanMessage(message.content)
}

@Injectable()
/**
 * The LangChain clients of the app (BE-AI-3): `ChatOpenAI` and `OpenAIEmbeddings` pointed at the gateway with the virtual key, and the
 * chain of a chat call (BE-AI-4): retrieval of the business notes (BE-AI-5), the prompt, the model, and the structured parse. The
 * network is the platform HTTP port (BE-INFRA-2), so every call has a deadline and the clients reach nothing else.
 */
export class AiClient implements AiRunner {
    constructor(
        @InjectAiEndpointOptions() private readonly endpoint: AiEndpoint,
        @InjectHttpClient() private readonly http: HttpClient,
    ) {}

    /** Runs one chat chain: retrieve the notes (when asked), fill the prompt, call the model. */
    async chat(request: AiChatRequest): Promise<ChainReply> {
        let retrieved = 0
        const retrieve = RunnableLambda.from(async (messages: ReadonlyArray<AiMessage>) => {
            const { context } = request
            if (context === null) return { messages: messages.map(messageOf) }
            const found = await new PassageRetriever(context.search, context.limit).invoke(context.question)
            retrieved = found.length
            const block = notesBlock(
                found.map((document) => ({ title: titleOf(document.metadata), content: document.pageContent })),
            )
            return { messages: withNotes(messages, block).map(messageOf) }
        })
        const prompt = ChatPromptTemplate.fromMessages([new MessagesPlaceholder("messages")])
        const chain = RunnableSequence.from([retrieve, prompt, this.modelFor(request)])
        const result: unknown = await chain.invoke(request.messages)
        const structured = request.json
        const raw = structured ? fieldOf(result, "raw") : result
        return {
            content: fieldOf(raw, "content"),
            parsed: structured ? (fieldOf(result, "parsed") ?? null) : null,
            usageMetadata: fieldOf(raw, "usage_metadata"),
            responseMetadata: fieldOf(raw, "response_metadata"),
            retrieved,
        }
    }

    /** Embeds the texts with LangChain embeddings pointed at the same endpoint. */
    embed(request: AiEmbedRequest): Promise<unknown> {
        return new OpenAIEmbeddings({
            model: this.endpoint.embeddingModel,
            apiKey: this.endpoint.virtualKey.reveal(),
            dimensions: request.dimensions,
            maxRetries: 0,
            timeout: request.timeoutMs,
            configuration: { baseURL: this.endpoint.gatewayUrl, fetch: this.fetcher(request.timeoutMs) },
        }).embedDocuments([...request.input])
    }

    /** The model of one call: plain, or JSON mode parsed into the schema (the raw message is kept for usage). */
    private modelFor(request: AiChatRequest): Runnable {
        const model = new ChatOpenAI({
            model: this.endpoint.chatModel,
            apiKey: this.endpoint.virtualKey.reveal(),
            temperature: 0,
            maxRetries: 0,
            timeout: request.timeoutMs,
            configuration: { baseURL: this.endpoint.gatewayUrl, fetch: this.fetcher(request.timeoutMs) },
        })
        if (!request.json) return model
        return model.withStructuredOutput(request.schema ?? ANY_OBJECT, { method: "jsonMode", includeRaw: true })
    }

    /** A fetch over the platform HTTP port for the clients: the body goes as the bytes the client wrote, the answer comes back as text. */
    private fetcher(timeoutMs: number): AiFetch {
        return async (input, init) => {
            const headers = new Headers(init?.headers)
            const answer = await this.http.request({
                method: "POST",
                url: urlOf(input),
                headers: Object.fromEntries(headers.entries()),
                bytes: Buffer.from(typeof init?.body === "string" ? init.body : ""),
                read: "text",
                timeoutMs,
            })
            return new Response(typeof answer.body === "string" ? answer.body : "", {
                status: answer.status,
                headers: answer.headers ?? {},
            })
        }
    }
}
