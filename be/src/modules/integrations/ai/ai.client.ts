import { createHash } from "node:crypto"
import { Document } from "@langchain/core/documents"
import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts"
import { BaseRetriever } from "@langchain/core/retrievers"
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables"
import { parseJsonMarkdown } from "@langchain/core/output_parsers"
import { Injectable } from "@nestjs/common"
import { InjectHttpClient, type HttpClient } from "@modules/platform/http"
import { attempt } from "@modules/platform/primitives"
import type {
    ChainReply,
    AiBudget,
    AiChatRequest,
    AiEmbedRequest,
    AiFetch,
    AiMessage,
    AiOutputSchema,
    AiChatModel,
    AiRunner,
    AiTurnRequest,
    PassageSearch,
    RoutedChat,
    RoutedModels,
} from "./ai.contracts"
import { InjectAiEndpointOptions } from "./ai.decorators"
import type { AiEndpoint } from "./ai.options"
import { ANY_OBJECT, type AiSchema } from "./ai.schema"
import { thinkingAskOf } from "./anthropic-thinking.policy"
import { automaticCacheFieldsOf, CACHE_MARK_KINDS, markedContentOf, withinMarkLimit } from "./cache-marks.policy"
import { gatewayRoutedModels } from "./routed-models.adapter"
import { fieldOf, notesBlock, textOf, withNotes } from "./reply.policy"
import { providerFieldOf } from "./routing.policy"

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

/**
 * The line a JSON call ends its prompt with, for every protocol: the OpenAI route also gets `response_format: json_object`, the
 * Anthropic route has no JSON mode (the answer is parsed from its text). Last, so the cached prefix before it stays the same text.
 */
export const JSON_ONLY_LINE = "Answer with one JSON object only: no prose before or after it."

/** The `response_format` of a JSON call on the `openai` protocol: one JSON object. */
const JSON_OBJECT_FORMAT = { response_format: { type: "json_object" } }

/**
 * The JSON object of an answer's text parsed into the schema (bare or fenced), or null when it is none: the same null a structured
 * parse that keeps the raw message gives, so the caller's loose parse and its tries decide what happens next.
 */
export const parsedOf = (text: string, schema: AiSchema): unknown => {
    // Fences stripped, then a strict parse: half an object is no answer.
    const read = attempt((): unknown => parseJsonMarkdown(text, JSON.parse))
    if (!read.ok) return null
    const checked = schema.safeParse(read.value)
    return checked.success ? checked.data : null
}

/**
 * The Anthropic constructor field of a call's structured output: `outputConfig.format` of type `json_schema` merged with the effort
 * the call already carries there (`anthropic-thinking.policy`), so neither replaces the other. Nothing when the call names no schema.
 */
export const structuredFieldsOf = (
    effort: Readonly<Record<string, unknown>>,
    schema: AiOutputSchema | undefined,
): Readonly<Record<string, unknown>> => {
    if (schema === undefined) return {}
    const current: unknown = effort["outputConfig"]
    const base = typeof current === "object" && current !== null ? current : {}
    return { outputConfig: { ...base, format: { type: "json_schema", schema } } }
}

/** The sampling temperature of every chat call whose model takes one: the same prompt gives the same answer as far as it can. */
const TEMPERATURE = 0

/**
 * The `reasoning` field a budget adds to the chat body: the model's reasoning switched off, or bounded. A direct cap
 * (`max_tokens`) is sent in place of the effort when the budget names one, since the endpoint takes one or the other. The reasoning
 * text is never asked back (`exclude`): nobody reads it, it is only counted (`reasoningTokens` of the usage).
 */
export const reasoningFieldOf = (budget: AiBudget): Readonly<Record<string, unknown>> => {
    if (budget.effort === "off") return { reasoning: { enabled: false } }
    const bound =
        budget.reasoningMaxTokens === undefined ? { effort: budget.effort } : { max_tokens: budget.reasoningMaxTokens }
    return { reasoning: { ...bound, exclude: true } }
}

/**
 * The `session_id` field a call's affinity adds to the chat body: OpenRouter routes every request of one session to the same
 * upstream, which is what lets a prefix-cached prompt be found again. A digest, so no id of the app leaves it.
 */
const sessionFieldOf = (affinity: string | undefined): Readonly<Record<string, unknown>> =>
    affinity === undefined || affinity === ""
        ? {}
        : { session_id: createHash("sha256").update(affinity).digest("hex").slice(0, 32) }

/** The upstream's own body fields of a call: the reasoning bound, the cache affinity and, when the call names one, the routing. */
const upstreamFieldsOf = (request: AiTurnRequest): Readonly<Record<string, unknown>> => ({
    ...(request.budget === undefined ? {} : reasoningFieldOf(request.budget)),
    ...sessionFieldOf(request.affinity),
    // Nothing unless the call names a routing: the body then has no `provider` field.
    ...providerFieldOf(request.routing),
})

const urlOf = (input: string | URL | Request): string => {
    if (typeof input === "string") return input
    return input instanceof URL ? input.href : input.url
}

/** A system message, with its cache breakpoint when it is marked and the protocol takes breakpoints (`cache-marks.policy.ts`). */
const systemOf = (message: AiMessage, marks: boolean): BaseMessage => {
    const content = markedContentOf(message.content, message.cacheMark === true, marks)
    return typeof content === "string" ? new SystemMessage(content) : new SystemMessage({ content: [...content] })
}

const messageOf = (message: AiMessage, marks: boolean): BaseMessage => {
    if (message.role === "system") return systemOf(message, marks)
    if (message.role === "assistant") return new AIMessage(message.content)
    const images = message.images ?? []
    if (images.length === 0) {
        // A marked user message is the end of a cacheable layer that is data, not instructions (a document the calls after it share).
        const content = markedContentOf(message.content, message.cacheMark === true, marks)
        return typeof content === "string" ? new HumanMessage(content) : new HumanMessage({ content: [...content] })
    }
    return new HumanMessage({
        content: [
            { type: "text", text: message.content },
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
    })
}

@Injectable()
/**
 * The LangChain clients of the app (BE-AI-3): `ChatOpenAI` and `OpenAIEmbeddings` pointed at the gateway with the virtual key, and the
 * chain of a chat call (BE-AI-4): retrieval of the business notes (BE-AI-5), the prompt, the model, and the structured parse. The
 * network is the platform HTTP port (BE-INFRA-2), so every call has a deadline and the clients reach nothing else.
 */
export class AiClient implements AiRunner {
    /** The router's clients: the one door a chat or embeddings client comes from. */
    private readonly routed: RoutedModels

    constructor(
        @InjectAiEndpointOptions() private readonly endpoint: AiEndpoint,
        @InjectHttpClient() private readonly http: HttpClient,
    ) {
        this.routed = gatewayRoutedModels(endpoint, (timeoutMs) => this.fetcher(timeoutMs))
    }

    /** Runs one chat chain: retrieve the notes (when asked), fill the prompt, call the model. */
    async chat(request: AiChatRequest): Promise<ChainReply> {
        let retrieved = 0
        const routed = await this.routedOf(request)
        const marks = CACHE_MARK_KINDS[routed.kind]
        const wire = (messages: ReadonlyArray<AiMessage>): Array<BaseMessage> =>
            withinMarkLimit(messages).map((message) => messageOf(message, marks))
        const asked: ReadonlyArray<AiMessage> = request.json
            ? [...request.messages, { role: "system", content: JSON_ONLY_LINE }]
            : request.messages
        const retrieve = RunnableLambda.from(async (messages: ReadonlyArray<AiMessage>) => {
            const { context } = request
            if (context === null) return { messages: wire(messages) }
            const found = await new PassageRetriever(context.search, context.limit).invoke(context.question)
            retrieved = found.length
            const block = notesBlock(
                found.map((document) => ({ title: titleOf(document.metadata), content: document.pageContent })),
            )
            return { messages: wire(withNotes(messages, block)) }
        })
        const prompt = ChatPromptTemplate.fromMessages([new MessagesPlaceholder("messages")])
        const chain = RunnableSequence.from([retrieve, prompt, routed.model])
        const raw: unknown = await chain.invoke(asked)
        const content = fieldOf(raw, "content")
        return {
            content,
            parsed: request.json ? parsedOf(textOf(content), request.schema ?? ANY_OBJECT) : null,
            provider: fieldOf(fieldOf(fieldOf(raw, "additional_kwargs"), "__raw_response"), "provider"),
            usageMetadata: fieldOf(raw, "usage_metadata"),
            responseMetadata: fieldOf(raw, "response_metadata"),
            retrieved,
        }
    }

    /** Embeds the texts with the router's embeddings client of the endpoint's profile (its vector length is the pool's). */
    async embed(request: AiEmbedRequest): Promise<unknown> {
        const routed = await this.routed.embeddings(this.endpoint.embeddingModel, request.timeoutMs)
        return routed.embeddings.embedDocuments([...request.input])
    }

    /**
     * The chat client of one try of an agent turn. The agent loop binds its tools and makes the call; this client only carries what
     * holds for the try: the deadline (no retry of its own), the reasoning, the output limit, the affinity, the routing and the gateway.
     */
    async turnModel(request: AiTurnRequest): Promise<AiChatModel> {
        return (await this.routedOf(request)).model
    }

    /**
     * The one way a chat client is built: from the router's door, for the call's model (the endpoint's chat profile when it names
     * none), with no retry of its own, bounded by the call's deadline and budget. On a retry after a provider failure or a timeout
     * (`fallback`), the name's client through its next protocol when it has one. Each protocol's own fields ride under its kind and
     * reach only that kind's client: for `openai`, temperature 0 where every provider of the name takes one, the upstream's own fields
     * (reasoning, cache affinity, upstream routing) where an OpenAI-compatible upstream serves it, and JSON mode for a JSON call; for
     * `anthropic`, the automatic cache breakpoint and the call's effort in the fields of the MODEL that serves it
     * (`anthropic-thinking.policy` `thinkingAskOf`: a profile whose models take different bodies is pinned to one of them, the next one
     * on a `fallback` try, with the body built again for it).
     */
    private async routedOf(request: AiTurnRequest & { readonly json?: boolean; readonly outputSchema?: AiOutputSchema }): Promise<RoutedChat> {
        const { target } = request
        const asked = thinkingAskOf(
            target?.name ?? this.endpoint.chatModel,
            request.budget,
            request.fallback === true,
            this.endpoint.profileRoutes ?? {},
        )
        const name = asked.name
        const routed = await this.routed.chat(name, {
            timeoutMs: request.timeoutMs,
            ...(request.budget?.maxTokens === undefined ? {} : { maxTokens: request.budget.maxTokens }),
            // A call with no target asks the endpoint's chat profile (`work`), Claude only since 2026-11-11 (Haiku 5.5 and Sonnet 5.5
            // refuse a non-default temperature; OpenRouter's fields mean nothing there): it gets neither.
            fields: {
                anthropic: { ...automaticCacheFieldsOf().anthropic, ...asked.fields, ...structuredFieldsOf(asked.fields, request.outputSchema) },
                openai: {
                    ...(target?.sampling === true ? { temperature: TEMPERATURE } : {}),
                    // The raw answer rides along so the upstream that served the call can be read (the prompt cache is per upstream).
                    __includeRawResponse: true,
                    modelKwargs: {
                        ...(target?.upstreamFields === true ? upstreamFieldsOf(request) : {}),
                        ...(request.json === true ? JSON_OBJECT_FORMAT : {}),
                    },
                },
            },
        })
        return request.fallback === true ? (routed.fallbacks[0] ?? routed) : routed
    }

    /** A fetch over the platform HTTP port for the clients: the body goes as the bytes the client wrote, the answer comes back as text. */
    private fetcher(timeoutMs: number): AiFetch {
        return async (input, init) => {
            const headers = new Headers(init?.headers)
            // The catalog read is a GET with no body; every model call a POST of the bytes the client wrote.
            const asked = init?.method ?? (input instanceof Request ? input.method : undefined)
            const withoutAsked = init?.body === undefined ? "GET" : "POST"
            const method = (asked ?? withoutAsked).toUpperCase() === "GET" ? "GET" : "POST"
            const answer = await this.http.request({
                method,
                url: urlOf(input),
                headers: Object.fromEntries(headers.entries()),
                ...(method === "GET" ? {} : { bytes: Buffer.from(typeof init?.body === "string" ? init.body : "") }),
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
