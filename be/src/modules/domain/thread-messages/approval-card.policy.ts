import type {
    ApprovalAsk,
    ApprovalCard,
    CardEnding,
    MentionView,
    OpenedApproval,
    ThreadMessageRecord,
} from "./thread-messages.contracts"

/** What a card is built from: the ask, what the gate answered, the names of the people it left out and the owner a bad end goes to. */
export interface CardSource {
    /** What the agent asked. */
    readonly ask: ApprovalAsk
    /** What the gate answered. */
    readonly opened: OpenedApproval
    /** Display names by member id, for the people the gate left out. */
    readonly names: Readonly<Record<string, string>>
    /** The owner an expired or refused ask goes back to. */
    readonly owner: MentionView | null
}

/** A fresh card: everyone tagged is waiting, nothing is decided. */
export const openCard = (source: CardSource): ApprovalCard => ({
    requestId: source.opened.requestId,
    action: source.ask.title,
    amount: source.ask.amount,
    unit: source.ask.unit,
    rule: source.ask.rule,
    policy: source.opened.policy,
    expiresAt: source.opened.expiresAt,
    approvers: source.opened.approvers.map((approver) => ({ ...approver, status: "waiting" })),
    excluded: source.opened.excluded.map((left) => ({ ...left, name: source.names[left.memberId] ?? "" })),
    outcome: "pending",
    decidedBy: null,
    decidedByName: null,
    decidedAt: null,
    owner: source.owner,
})

/** The card with one tagged member's verdict recorded; a card of someone not tagged is unchanged. */
export const withVote = (card: ApprovalCard, memberId: string, verdict: "approve" | "reject"): ApprovalCard => ({
    ...card,
    approvers: card.approvers.map((approver) =>
        approver.memberId === memberId
            ? { ...approver, status: verdict === "approve" ? "approved" : "rejected" }
            : approver,
    ),
})

/** The card once the request ended: how, by whom and when. */
export const settleCard = (card: ApprovalCard, ending: CardEnding, at: Date): ApprovalCard => ({
    ...card,
    outcome: ending.outcome,
    decidedBy: ending.decidedBy,
    decidedByName: ending.decidedByName,
    decidedAt: at.toISOString(),
})

/** The message and its card when the card still waits for a decision; null when the message has no card or it was already decided. */
export const pendingOf = (
    row: ThreadMessageRecord,
): { readonly row: ThreadMessageRecord; readonly card: ApprovalCard } | null =>
    row.approval !== null && row.approval.outcome === "pending" ? { row, card: row.approval } : null
