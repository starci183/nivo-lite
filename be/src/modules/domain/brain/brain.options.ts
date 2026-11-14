import type { Type } from "@nestjs/common"
import type { CorrectionSource } from "./brain.contracts"

/** What the full brain capability needs from the composition root. */
export interface BrainFullOptions {
    /**
     * Where the owner's corrections of the agents' work come from. Absent: none (the old work engine's decision log, its only source,
     * is gone, and no thread-era road records a correction yet).
     */
    readonly corrections?: Type<CorrectionSource>
    /** Absent or false: the full capability. */
    readonly derivationsOnly?: false
    /** Absent: the full capability. */
    readonly graphOnly?: false
}

/**
 * The derivations mode of an app that writes facts but runs no pass: only the policy derivations (`BrainPolicyDerivationsService`) with
 * their queue, so a fact change made there is announced and queues a pass for the api's worker (mcp), and `cli brain-policies backfill`
 * can queue a pass per workspace (cli); with `vectors`, the vectors listener too (one embedding call for the changed facts); no team
 * chat, no read or edit door.
 */
export interface BrainDerivationsOptions {
    /** Registers the derivations mode. */
    readonly derivationsOnly: true
    /**
     * Also registers the vectors listener (`FactEmbeddingsService`): a fact this process puts in force gets its vector at once, as in the
     * api. Only for an app that has the AI endpoint and the usage meter (`AiModule`, `KnowledgeModule` search mode): the mcp. Absent or
     * false (the cli): the api's timed sweep gives such a fact its vector.
     */
    readonly vectors?: boolean
}

/**
 * The graph mode of an app that only reads the truths in force (the mcp app's truths search, `nivo.api.nivo.brain.search`): the
 * graph read alone, no write, no derivation, no vector, no queue.
 */
export interface BrainGraphOptions {
    /** Registers the graph mode. */
    readonly graphOnly: true
    /** Never set with the graph mode. */
    readonly derivationsOnly?: false
}

/** What the brain capability needs from the composition root: the full capability, the derivations mode or the graph mode. */
export type BrainOptions = BrainFullOptions | BrainDerivationsOptions | BrainGraphOptions
