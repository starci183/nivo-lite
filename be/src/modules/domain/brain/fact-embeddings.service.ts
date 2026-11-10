import { Injectable } from "@nestjs/common"
import { BrainFactEmbeddingsService, factEmbedHashOf, factEmbedTextOf, needsEmbedding } from "@modules/domain/brain-facts"
import type { EmbeddingIdentity } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { EMBEDDING_DIMENSIONS, hasStoredSize } from "@modules/domain/knowledge-chunks"
import { InjectAi } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainLogEvent } from "./brain.log-events"

/** How long one batch of fact lines may take to embed. */
const EMBED_TIMEOUT_MS = 20_000

/** The most facts one refresh looks at. */
const REFRESH_MAX = 500

/** What one refresh did. */
export interface EmbeddingsRefreshed {
    /** Facts that got a (new) vector. */
    readonly embedded: number
    /** Facts whose vector was current: same text hash, same identity; nothing was sent for them. */
    readonly unchanged: number
}

@Injectable()
/**
 * Keeps the vectors of the truth graph's facts current, through the ONE embedding door of the AI layer (`AiService.embed` with the
 * configured profile `AiService.embeddingModel()`, metered per workspace as the passages are; WM's `RoutedModels.embeddings(<profile>)`
 * replaces the inside of that door, not this call). A fact whose line has the same hash
 * under the same identity is never embedded again; a fact of another identity is embedded again (the re-index), never compared.
 */
export class FactEmbeddingsService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly usage: UsageMeterService,
        private readonly vectors: BrainFactEmbeddingsService,
    ) {}

    /** The pinned identity new vectors are made with: the configured profile and the stored column's dimensions. */
    identity(): EmbeddingIdentity {
        return { model: this.ai.embeddingModel(), dimensions: EMBEDDING_DIMENSIONS }
    }

    /** Embeds the facts in force of a workspace that have no current vector; a failure is logged and the facts stay searchable by words. */
    async refresh(workspaceId: string): Promise<EmbeddingsRefreshed> {
        if (!this.ai.available()) return { embedded: 0, unchanged: 0 }
        try {
            const identity = this.identity()
            const states = await this.vectors.inForce(workspaceId, REFRESH_MAX)
            const todo = states
                .map((state) => ({ state, hash: factEmbedHashOf(state.fact) }))
                .filter(({ state, hash }) => needsEmbedding(state.stored, hash, identity))
            const unchanged = states.length - todo.length
            if (todo.length === 0) return { embedded: 0, unchanged }
            const texts = todo.map(({ state }) => factEmbedTextOf(state.fact))
            const answer = await this.ai.embed({ input: texts, dimensions: identity.dimensions, timeoutMs: EMBED_TIMEOUT_MS })
            if (answer === null || !hasStoredSize(answer.vectors, texts.length)) return { embedded: 0, unchanged }
            await this.usage.record({
                workspaceId,
                kind: "embedding",
                module: "knowledge",
                model: identity.model,
                usage: answer.usage,
                promptChars: texts.reduce((sum, text) => sum + text.length, 0),
            })
            const vectors = answer.vectors
            const pairs = todo.flatMap((entry, index) => {
                const vector = vectors[index]
                return vector === undefined ? [] : [{ ...entry, vector }]
            })
            await eachInOrder(pairs, ({ state, hash, vector }) =>
                this.vectors.store(workspaceId, state.fact.id, vector, identity, hash),
            )
            return { embedded: pairs.length, unchanged }
        } catch (cause) {
            this.logger.error(BrainLogEvent.EmbeddingsFailed, cause, { workspaceId })
            return { embedded: 0, unchanged: 0 }
        }
    }
}
