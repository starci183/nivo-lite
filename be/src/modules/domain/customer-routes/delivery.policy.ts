/** The states of one delivery row. */
export type DeliveryState = "claimed" | "delivered" | "refused" | "unknown"

/** What `claim` tells the caller to do: ask the provider, or answer what the ledger already holds. */
export type ClaimVerdict = "send" | "delivered" | "unknown"

/** The kept reason of an attempt whose outcome nobody knows (a crash or a lost answer between the claim and the settle). */
export const DELIVERY_OUTCOME_UNKNOWN = "delivery_outcome_unknown"

/** The reasons that leave a send uncertain: another attempt waits for a person, never for a machine (engine-core rule 9). */
const UNCERTAIN_REASONS: ReadonlySet<string> = new Set([DELIVERY_OUTCOME_UNKNOWN, "delivery_failed", "zalo_error"])

/** The state an attempt settles at: a refusal whose reason leaves the outcome uncertain is `unknown`, never `refused`. */
export const settledStateOf = (state: "refused" | "unknown", reason: string | null): "refused" | "unknown" =>
    state === "unknown" || (reason !== null && UNCERTAIN_REASONS.has(reason)) ? "unknown" : "refused"

/**
 * What a claim of a send key answers by the state of the row already kept: `delivered` once it went out, `unknown` while an earlier
 * attempt is in flight or ended uncertain (the caller never sends it again), and, for a definite refusal only, `send` again.
 */
export const heldVerdictOf = (state: DeliveryState, again = false): ClaimVerdict => {
    if (state === "delivered") return "delivered"
    return state === "refused" || (again && state === "unknown") ? "send" : "unknown"
}

/**
 * The states a claim takes back: a definite refusal always; an attempt that ENDED unknown too when the caller's tool declares itself
 * `repeatable` (rule Q-3: sent again under the same key, the worst case a duplicate). A row still `claimed` (in flight) never.
 */
export const reclaimableOf = (again: boolean): ReadonlyArray<"refused" | "unknown"> => (again ? ["refused", "unknown"] : ["refused"])
