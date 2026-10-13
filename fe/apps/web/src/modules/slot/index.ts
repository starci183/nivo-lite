import type { DbOutcome } from "@/modules/db"
import type { DataSlot } from "@/modules/types"

/** Folds a database outcome into a slot; a refusal is its own status, never a generic error. */
export const toSlot = <T>(outcome: DbOutcome<T>): DataSlot<T> => {
    if (outcome.kind === "ok") return { items: outcome.value }
    if (outcome.kind === "refused") return { isForbidden: true }
    return { isError: true }
}
