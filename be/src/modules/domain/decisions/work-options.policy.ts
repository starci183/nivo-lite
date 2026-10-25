import type { Proposal } from "./decisions.contracts"
import type { ProcessOptions } from "./work-engine.contracts"

/** Stores execution choices with a proposal so a later worker makes the same admission decisions. */
export const proposalWithOptions = <T extends Partial<Proposal>>(proposal: T, options: ProcessOptions): T => {
    if (options.preset === undefined && options.noChain === undefined && options.forceAsk === undefined) return proposal
    return {
        ...proposal,
        execution: { preset: options.preset, noChain: options.noChain, forceAsk: options.forceAsk },
    }
}

/** Recovers a queued item's choices; an immediate caller can supply an explicit choice. */
export const processOptionsOf = (proposal: Proposal, options: ProcessOptions = {}): ProcessOptions => ({
    preset: options.preset ?? proposal.execution?.preset,
    noChain: options.noChain ?? proposal.execution?.noChain,
    forceAsk: options.forceAsk ?? proposal.execution?.forceAsk,
})
