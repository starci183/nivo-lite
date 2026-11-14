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
 * their queue, so `cli brain-policies backfill` can queue a pass per workspace (cli); no vectors listener (the api's vector reconcile
 * gives a fact changed there its point), no team chat, no read or edit door.
 */
export interface BrainDerivationsOptions {
    /** Registers the derivations mode. */
    readonly derivationsOnly: true
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
