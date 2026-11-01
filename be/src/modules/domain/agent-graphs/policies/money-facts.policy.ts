import type { MoneyEvidence, MoneyTurn } from "@modules/domain/authority-rules"
import type { FactValues, GraphDocument } from "../agent-graphs.contracts"

/** The one amount a branch reads, with where it came from: `source` is claimed or received, `via` is the road that brought it. */
export const MONEY_AMOUNT = "money.amount_vnd"
export const MONEY_SOURCE = "money.source"
export const MONEY_VIA = "money.via"

/** What a turn with no money in it reads as. */
const NONE = "none"

/** The sources the triggers of the graph accept, or null when none chose, and then every source counts. */
const acceptedBy = (document: GraphDocument): ReadonlySet<string> | null => {
    const chosen = document.nodes.flatMap((node) => (node.kind === "trigger" ? (node.moneySources ?? []) : []))
    return chosen.length === 0 ? null : new Set(chosen)
}

/** The money of a turn as the graph sees it: the setting on its trigger says which sources count, and a shop chooses its own. */
export const moneyAccepted = (document: GraphDocument, money: MoneyTurn | undefined): MoneyTurn | undefined => {
    const accepted = acceptedBy(document)
    if (money === undefined || accepted === null) return money
    return { ...money, evidence: money.evidence.filter((entry) => accepted.has(entry.via)) }
}

const usable = (entry: MoneyEvidence): boolean => entry.amountVnd !== null

/**
 * The amount facts of a turn. Money that was received wins over money that was claimed. A turn with a money event and no amount leaves
 * them out, so the branch falls to the `else` and the turn waits; a turn with no money event reads 0, which is a reading and not a gap,
 * so a greeting or a price question does not wait. No turn information at all answers nothing.
 */
export const moneyFactsOf = (money: MoneyTurn | undefined): FactValues => {
    if (money === undefined) return {}
    const found = money.evidence.filter(usable)
    const chosen = found.find((entry) => entry.source === "received") ?? found[0]
    if (chosen === undefined) return money.asked ? {} : { [MONEY_AMOUNT]: 0, [MONEY_SOURCE]: NONE, [MONEY_VIA]: NONE }
    return { [MONEY_AMOUNT]: chosen.amountVnd ?? 0, [MONEY_SOURCE]: chosen.source, [MONEY_VIA]: chosen.via }
}
