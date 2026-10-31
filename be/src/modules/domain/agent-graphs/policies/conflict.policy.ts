import { createHash } from "node:crypto"

/** What a Brain rule says, kept as a hash so a changed rule is found without keeping the text of the owner twice. */
export const valueHashOf = (value: string): string =>
    createHash("sha256").update(value.trim().toLowerCase()).digest("hex")

/** What the tick needs to know about the Brain fact a rule cites. */
export interface CitedFact {
    /** The fact. */
    readonly id: string
    /** Where it stands: only an active fact is in force. */
    readonly status: string
    /** The value as written. */
    readonly value: string
}

/** A newer rule that replaced the one a node cites, with the words of both. */
export interface Conflict {
    /** The fact in force now. */
    readonly newFactId: string
    /** The hash of its value. */
    readonly newValueHash: string
    /** The key that makes the proposal the same one however often the tick runs. */
    readonly dedupeKey: string
}

/**
 * Whether the rule a node cites was replaced: the cited fact is no longer in force and a fact is, with a value that hashes to something
 * else than what the owner confirmed. A Brain change never changes the graph; this only says the owner should look.
 */
export const conflictOf = (
    nodeKey: string,
    confirmedHash: string,
    cited: CitedFact | null,
    inForce: CitedFact | null,
): Conflict | null => {
    if (cited === null || cited.status === "active" || inForce === null) return null
    const newValueHash = valueHashOf(inForce.value)
    return newValueHash === confirmedHash
        ? null
        : { newFactId: inForce.id, newValueHash, dedupeKey: `conflict:${nodeKey}:${inForce.id}` }
}
