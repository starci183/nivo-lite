import { Injectable } from "@nestjs/common"
import {
    BrainFactEmbeddingsService,
    BrainFactsService,
    factEmbedHashOf,
    factEmbedTextOf,
    needsEmbedding,
} from "@modules/domain/brain-facts"
import type { EmbeddedStatus, EmbeddingIdentity, FactEmbeddingState, FactRecord, NearFact } from "@modules/domain/brain-facts"
import { UsageMeterService } from "@modules/domain/knowledge"
import { EMBEDDING_DIMENSIONS, hasStoredSize } from "@modules/domain/knowledge-chunks"
import { InjectAi } from "@modules/integrations/ai"
import type { AiBudget, AiService } from "@modules/integrations/ai"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { BrainLogEvent } from "./brain.log-events"
import { FactReadingLogEvent } from "./fact-reading.log-events"
import { ModelJsonService } from "./model-json.service"
import { SAME_FACT_CANDIDATES, SAME_FACT_PROMPT, SAME_MEANING_DISTANCE, sameFactOf, sameFactPrompt } from "./same-fact.policy"

/** How long one batch of fact lines may take to embed. */
const EMBED_TIMEOUT_MS = 20_000

/** The most facts one refresh looks at. */
const REFRESH_MAX = 500

/** The most fact lines one embedding call carries (the passages' batch size). */
const EMBED_BATCH = 32

/** How long one "same fact?" judgement may take. */
const JUDGE_TIMEOUT_MS = 20_000

/** What one judgement may spend: no reasoning, a one-line JSON answer. */
const JUDGE_BUDGET: AiBudget = { effort: "off", maxTokens: 200 }

/** What one refresh did. */
export interface EmbeddingsRefreshed {
    /** Facts that got a (new) vector. */
    readonly embedded: number
    /** Facts whose vector was current: same text hash, same identity; nothing was sent for them. */
    readonly unchanged: number
}

/** What a search for "the same fact in other words" looks at. */
export interface NearMeaningOptions {
    /** The statuses compared with; default: in force and waiting. */
    readonly statuses?: ReadonlyArray<EmbeddedStatus>
    /** Only candidates under this cosine distance; default `SAME_MEANING_DISTANCE`. */
    readonly maxDistance?: number
    /** At most this many candidates per fact, nearest first; default `SAME_FACT_CANDIDATES`. */
    readonly limit?: number
    /** Facts never offered as a candidate (for example the other facts filed from the same window). */
    readonly excludeIds?: ReadonlyArray<string>
}

/** One fact with the facts of OTHER keys that may say the same thing (`nearMeaning`). */
export interface NearMeaning {
    /** The fact asked about. */
    readonly fact: FactRecord
    /** Facts of another subject or attribute, same instance scope, near in meaning, nearest first. */
    readonly near: ReadonlyArray<NearFact>
}

/** What one pass of the same-meaning check did. */
export interface SameMeaningChecked {
    /** Facts that had a candidate under the distance: one judgement each. */
    readonly judged: number
    /** Facts the model judged the same as a candidate: flagged `same_meaning` for the founder. */
    readonly flagged: number
}

@Injectable()
/**
 * Keeps the vectors of the truth graph's facts current, through the ONE embedding door of the AI layer (`AiService.embed` with the
 * configured profile `AiService.embeddingModel()`, metered per workspace as the passages are; WM's `RoutedModels.embeddings(<profile>)`
 * replaces the inside of that door, not this call). A fact whose line has the same hash under the same identity is never embedded
 * again; a fact of another identity is embedded again (the re-index), never compared. Proposals are embedded when a document files them
 * (one batched call per window), so the same fact in other words is found before anything is in force, and approving one sends nothing.
 */
export class FactEmbeddingsService {
    constructor(
        @InjectAi() private readonly ai: AiService,
        @InjectLogger() private readonly logger: Logger,
        private readonly usage: UsageMeterService,
        private readonly vectors: BrainFactEmbeddingsService,
        private readonly facts: BrainFactsService,
        private readonly json: ModelJsonService,
    ) {}

    /** The pinned identity new vectors are made with: the configured profile and the stored column's dimensions. */
    identity(): EmbeddingIdentity {
        return { model: this.ai.embeddingModel(), dimensions: EMBEDDING_DIMENSIONS }
    }

    /** Embeds the facts in force of a workspace that have no current vector; a failure is logged and the facts stay searchable by words. */
    async refresh(workspaceId: string): Promise<EmbeddingsRefreshed> {
        if (!this.ai.available()) return { embedded: 0, unchanged: 0 }
        try {
            const states = await this.vectors.inForce(workspaceId, REFRESH_MAX)
            return await this.embedStates(workspaceId, states)
        } catch (cause) {
            this.logger.error(BrainLogEvent.EmbeddingsFailed, cause, { workspaceId })
            return { embedded: 0, unchanged: 0 }
        }
    }

    /**
     * The facts of OTHER keys that may be the same fact as each of these, by vector only (no model call): each fact without a current
     * vector is embedded first (one call per 32 lines, and the vector is stored), then compared in the database with the facts of the
     * same identity and instance scope, in force or waiting by default, under `SAME_MEANING_DISTANCE`. A candidate with the same subject
     * AND attribute is not "other words" (the key already joins them) and is left out, and so is a retire proposal.
     * This is the candidate read the document critic (BG3) uses for "clashes with facts in use"; it never writes anything but vectors.
     */
    async nearMeaning(
        workspaceId: string,
        facts: ReadonlyArray<FactRecord>,
        options: NearMeaningOptions = {},
    ): Promise<ReadonlyArray<NearMeaning>> {
        if (facts.length === 0 || !this.ai.available()) return []
        await this.embedStates(workspaceId, await this.vectors.statesOf(workspaceId, facts.map((fact) => fact.id)))
        const identity = this.identity()
        const excluded = new Set(options.excludeIds ?? [])
        const limit = options.limit ?? SAME_FACT_CANDIDATES
        const found: Array<NearMeaning> = []
        await eachInOrder(facts, async (fact) => {
            const near = await this.vectors.nearestTo(workspaceId, fact.id, identity, {
                statuses: options.statuses ?? ["active", "proposed"],
                installationId: fact.installationId,
                maxDistance: options.maxDistance ?? SAME_MEANING_DISTANCE,
                // A few more than wanted: the same key and the excluded ones are dropped after the read.
                limit: limit + excluded.size + 3,
            })
            const other = near
                .filter(
                    (hit) =>
                        !excluded.has(hit.fact.id) &&
                        hit.fact.proposalKind === "set" &&
                        (hit.fact.subjectKey !== fact.subjectKey || hit.fact.attribute !== fact.attribute),
                )
                .slice(0, limit)
            if (other.length > 0) found.push({ fact, near: other })
        })
        return found
    }

    /**
     * The one fact IN FORCE of another key, same instance scope, nearest in meaning to a new chat proposal that replaces nothing by id
     * or key (FX5): the candidate a change card shows as "có thể thay cho", for the founder to confirm. Vector only, no model judgement
     * (the founder is the judge); nothing when the embedding budget is spent or the AI is off; never throws.
     */
    async nearestInForce(workspaceId: string, proposal: FactRecord): Promise<FactRecord | null> {
        try {
            if (await this.usage.blockedBy(workspaceId, "embedding", false)) return null
            const [pair] = await this.nearMeaning(workspaceId, [proposal], { statuses: ["active"], limit: 1 })
            return pair?.near[0]?.fact ?? null
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.SameMeaningFailed, cause, { workspaceId })
            return null
        }
    }

    /**
     * "The same thing in other words" for the facts one window of a document just filed (new proposals that disagree with nothing):
     * candidates by vector (`nearMeaning`, the window's own facts excluded: the reading already gives one thing one label inside a
     * window), then ONE cheap model judgement per fact that has a candidate. A fact judged the same as a candidate is flagged
     * `same_meaning` with `conflictWith` naming it, for the founder: approving it merges, nothing is merged here. Never throws: a failure
     * is logged and the facts stand unflagged.
     */
    async checkSameMeaning(workspaceId: string, filed: ReadonlyArray<FactRecord>): Promise<SameMeaningChecked> {
        const open = filed.filter(
            (fact) => fact.status === "proposed" && fact.proposalKind === "set" && fact.conflictWith === null,
        )
        if (open.length === 0) return { judged: 0, flagged: 0 }
        try {
            if (await this.usage.blockedBy(workspaceId, "embedding", false)) return { judged: 0, flagged: 0 }
            const pairs = await this.nearMeaning(workspaceId, open, { excludeIds: filed.map((fact) => fact.id) })
            if (pairs.length === 0 || (await this.usage.blockedBy(workspaceId, "brain", false))) {
                return { judged: 0, flagged: 0 }
            }
            let flagged = 0
            await eachInOrder(pairs, async ({ fact, near }) => {
                const same = await this.judge(workspaceId, fact, near)
                if (same !== null && (await this.facts.flagSameMeaning(workspaceId, fact.id, same.id))) flagged += 1
            })
            this.logger.info(FactReadingLogEvent.SameMeaningChecked, { workspaceId, judged: pairs.length, flagged })
            return { judged: pairs.length, flagged }
        } catch (cause) {
            this.logger.error(FactReadingLogEvent.SameMeaningFailed, cause, { workspaceId })
            return { judged: 0, flagged: 0 }
        }
    }

    /** Asks the model whether a fact is the same as one of its candidates; the candidate it names, or null. Metered as `brain`. */
    private async judge(workspaceId: string, fact: FactRecord, near: ReadonlyArray<NearFact>): Promise<FactRecord | null> {
        const candidates = near.map((hit) => hit.fact)
        const prompt = sameFactPrompt(fact, candidates)
        const answer = await this.ai.chat({
            messages: [
                { role: "system", content: SAME_FACT_PROMPT },
                { role: "user", content: prompt },
            ],
            json: false,
            schema: null,
            timeoutMs: JUDGE_TIMEOUT_MS,
            budget: JUDGE_BUDGET,
            context: null,
        })
        if (answer === null) return null
        await this.usage.record({
            workspaceId,
            kind: "brain",
            module: "knowledge",
            model: answer.model,
            usage: answer.usage,
            promptChars: SAME_FACT_PROMPT.length + prompt.length,
            completionChars: answer.text.length,
        })
        const index = sameFactOf(this.json.jsonOf(answer.text), candidates.length)
        return index === null ? null : (candidates[index] ?? null)
    }

    /** Embeds the facts among these whose stored vector is not current, in batches of `EMBED_BATCH` lines, and stores each vector. */
    private async embedStates(
        workspaceId: string,
        states: ReadonlyArray<FactEmbeddingState>,
    ): Promise<EmbeddingsRefreshed> {
        const identity = this.identity()
        const todo = states
            .map((state) => ({ state, hash: factEmbedHashOf(state.fact) }))
            .filter(({ state, hash }) => needsEmbedding(state.stored, hash, identity))
        const unchanged = states.length - todo.length
        let embedded = 0
        for (let from = 0; from < todo.length; from += EMBED_BATCH) {
            const batch = todo.slice(from, from + EMBED_BATCH)
            const texts = batch.map(({ state }) => factEmbedTextOf(state.fact))
            const answer = await this.ai.embed({ input: texts, dimensions: identity.dimensions, timeoutMs: EMBED_TIMEOUT_MS })
            if (answer === null || !hasStoredSize(answer.vectors, texts.length)) break
            await this.usage.record({
                workspaceId,
                kind: "embedding",
                module: "knowledge",
                model: identity.model,
                usage: answer.usage,
                promptChars: texts.reduce((sum, text) => sum + text.length, 0),
            })
            const vectors = answer.vectors
            const pairs = batch.flatMap((entry, index) => {
                const vector = vectors[index]
                return vector === undefined ? [] : [{ ...entry, vector }]
            })
            await eachInOrder(pairs, ({ state, hash, vector }) =>
                this.vectors.store(workspaceId, state.fact.id, vector, identity, hash),
            )
            embedded += pairs.length
        }
        return { embedded, unchanged }
    }
}
