import type { ActionOutcome } from "@nivo-lite/agent-sdk/block"
import type { SpecText } from "@nivo-lite/agent-sdk/schema"

/**
 * The words a block shows in place when an action refused: the message of a domain refusal (`refused`) or of a conflict (the record
 * changed under the person). Every other outcome has no such words, so the block tells it in a toast.
 */
export const refusalOf = (outcome: ActionOutcome): SpecText | null => {
    if (outcome.ok) return null
    return outcome.reason === "refused" || outcome.reason === "conflict" ? outcome.message : null
}
