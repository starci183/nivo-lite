import { AMOUNT_EVIDENCE, type GraphEvidence } from "@modules/domain/work-items"
import type { FactValues } from "../agent-graphs.contracts"

/** The one amount a branch reads, with where it came from: `source` is claimed or received, `via` is the road that brought it. */
export const MONEY_AMOUNT = "money.amount_vnd"
export const MONEY_SOURCE = "money.source"
export const MONEY_VIA = "money.via"

/** What a turn with no money in it reads as. */
const NONE = "none"
/** The amount of work whose road named no source: someone says so, nothing more. */
const CLAIMED = "claimed"
const RECEIVED = "received"
const PROPOSAL = "proposal"

const facts = (amount: number, source: string, via: string): FactValues => ({
    [MONEY_AMOUNT]: amount,
    [MONEY_SOURCE]: source,
    [MONEY_VIA]: via,
})

const amountOf = (entry: GraphEvidence): number | null =>
    typeof entry.value === "number" && Number.isFinite(entry.value) ? entry.value : null

/**
 * The amount facts of a turn. Money that was received wins over money that was claimed. An amount entry with no number is a money event
 * whose amount is missing or differs from another entry of the same authority, so the facts are left out and the branch falls to the
 * `else`; a turn with no entry and no amount of its own reads 0, which is a reading and not a gap, so a greeting or a price question does
 * not wait. No evidence list at all answers nothing.
 */
export const moneyFactsOf = (
    evidence: ReadonlyArray<GraphEvidence> | undefined,
    amountVnd: number | null | undefined,
): FactValues => {
    if (evidence === undefined) return {}
    const entries = evidence.filter((entry) => entry.key === AMOUNT_EVIDENCE)
    const first = entries[0]
    if (first === undefined) {
        if (typeof amountVnd !== "number") return facts(0, NONE, NONE)
        return Number.isFinite(amountVnd) ? facts(amountVnd, CLAIMED, PROPOSAL) : {}
    }
    const received = entries.filter((entry) => entry.kind === RECEIVED)
    const candidates = received.length === 0 ? entries : received
    const chosen = received[0] ?? first
    const amount = amountOf(chosen)
    if (amount === null || candidates.some((entry) => amountOf(entry) !== amount)) return {}
    return facts(amount, chosen.kind, chosen.via)
}
