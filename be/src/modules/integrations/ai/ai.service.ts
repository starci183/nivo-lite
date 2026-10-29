import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    ContextPassage,
    AiChatRequest,
    AiChatResult,
    AiEmbedRequest,
    AiEmbeddingResult,
    PassageSearch,
} from "./ai.contracts"
import { InjectAiOptions, InjectAiRunner } from "./ai.decorators"
import type { OptionalAiRunner } from "./ai.decorators"
import { AiLogEvent } from "./ai.log-events"
import type { AiOptions } from "./ai.options"
import { fieldOf, isRecord, modelOf, textOf, usageOf, vectorsOf } from "./reply.policy"

/** The most characters sent per embedded text; a passage is about 800 characters, this only guards a runaway input. */
const MAX_EMBED_CHARS = 8000

/** What a failure says, as log fields: its class and status; never its message, which may quote a provider or a prompt. */
const failureOf = (cause: unknown): Readonly<Record<string, unknown>> => ({
    errorClass: isRecord(cause) && typeof cause.name === "string" ? cause.name : "unknown",
    status: fieldOf(cause, "status") ?? null,
})

@Injectable()
/**
 * The one door to the language-model endpoint: LangChain (`@langchain/openai`) pointed at the AI router gateway with a virtual key, or
 * at a provider directly. A call never throws: without a key, or when the call failed, it answers null and callers fall back.
 */
export class AiService implements OnModuleInit {
    constructor(
        @InjectAiOptions() private readonly options: AiOptions,
        @InjectAiRunner() private readonly runner: OptionalAiRunner,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Boot never fails for a missing virtual key: it is logged once and every call answers unavailable. */
    onModuleInit(): void {
        if (this.runner === null && this.options.gatewayUrl !== null && this.options.virtualKey === null) {
            this.logger.warn(AiLogEvent.VirtualKeyMissing, { gatewayUrl: this.options.gatewayUrl })
        }
    }

    /** True when a key is set, so chat and embeddings calls can reach the endpoint. */
    available(): boolean {
        return this.runner !== null
    }

    /** The profile or model chat calls ask for. */
    chatModel(): string {
        return this.options.chatModel
    }

    /** The profile or model new vectors are made with, whether or not a key is set. */
    embeddingModel(): string {
        return this.options.embeddingModel
    }

    /**
     * One chat chain at temperature 0: the prompt (with the retrieved business notes when a context is given), the model and, for a
     * JSON task, the structured parse. Null when no key is set, the call failed or the answer is empty. A retrieval that fails
     * leaves the prompt without notes; it never fails the call.
     */
    async chat(request: AiChatRequest): Promise<AiChatResult> {
        if (this.runner === null) return null
        try {
            const reply = await this.runner.chat({ ...request, context: this.guarded(request.context) })
            const text = textOf(reply.content)
            const model = modelOf(reply.responseMetadata, this.options.chatModel)
            if (text === "") {
                this.logger.warn(AiLogEvent.ChatEmpty, { model })
                return null
            }
            return {
                text,
                parsed: isRecord(reply.parsed) ? reply.parsed : null,
                model,
                usage: usageOf(reply.usageMetadata, reply.responseMetadata),
                retrieved: reply.retrieved,
            }
        } catch (cause) {
            this.logger.warn(AiLogEvent.ChatFailed, failureOf(cause))
            return null
        }
    }

    /** Embeds texts in one call: the vectors in the order of the texts; null when no key is set or the call failed. */
    async embed(request: AiEmbedRequest): Promise<AiEmbeddingResult> {
        if (this.runner === null || request.input.length === 0) return null
        try {
            const answer = await this.runner.embed({
                ...request,
                input: request.input.map((text) => text.slice(0, MAX_EMBED_CHARS)),
            })
            return { vectors: vectorsOf(answer), usage: null }
        } catch (cause) {
            this.logger.warn(AiLogEvent.EmbeddingFailed, failureOf(cause))
            return null
        }
    }

    /** The context with a search that cannot fail the call: a failed search finds nothing and is logged. */
    private guarded(context: AiChatRequest["context"]): AiChatRequest["context"] {
        if (context === null) return null
        const search: PassageSearch = async (question): Promise<ReadonlyArray<ContextPassage>> => {
            try {
                return await context.search(question)
            } catch (cause) {
                this.logger.warn(AiLogEvent.RetrievalFailed, failureOf(cause))
                return []
            }
        }
        return { ...context, search }
    }
}
