import { isRecord } from "@modules/platform/primitives"

/** What the run already says about the plan it was opened for. */
export interface PlanBindingFacts {
    /** The binding kept in the run's context, or undefined when the run was never bound. */
    readonly binding: unknown
    /** The graph version the run carries, or null when it carries none. */
    readonly graphVersionId: string | null
    /** The version the opening asks for. */
    readonly versionId: string | null
    /** The trigger the opening asks for. */
    readonly trigger: string
}

/** Whether a run is bound to the plan asked for already (a replay), is free to be bound, or belongs to another plan. */
export type PlanBindingVerdict = "bound" | "unbound" | "conflict"

/**
 * Reads the run against the plan an opening asks for. A bound run must be bound to exactly this version and trigger; an unbound one may be
 * bound unless it carries another version. Whether steps began is the store's to read.
 */
export const planBindingVerdict = (facts: PlanBindingFacts): PlanBindingVerdict => {
    const { binding } = facts
    if (binding !== undefined)
        return isRecord(binding) &&
            facts.graphVersionId === facts.versionId &&
            binding.versionId === facts.versionId &&
            binding.trigger === facts.trigger
            ? "bound"
            : "conflict"
    return facts.graphVersionId !== null && facts.graphVersionId !== facts.versionId ? "conflict" : "unbound"
}
