import type { BranchRequest } from "@modules/domain/authority-rules"
import { itemOf } from "./work-engine.builder"

/** What one walk of the graph came to, as far as the specs of the decider read it. */
interface Walk {
    readonly outcome: "run" | "ask" | "stop" | "divert" | "unheld"
    readonly path: ReadonlyArray<string>
    readonly branchKey: string
    readonly approver: null
    readonly divert: { readonly action: string; readonly handoverTo: string | null; readonly asks: boolean } | null
    readonly unread: ReadonlyArray<string>
    readonly unjudged: "fact_unread" | "no_route" | "no_else" | "not_in_graph" | null
}

/** What the gate answers when the owner rule lets the work run alone, and when it asks. */
export const AUTO = { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] } as const
export const OVER = { verdict: "ask", reason: "over_authority", reasons: ["over_authority"], missing: [] } as const

/** What the model proposed: an amount the records may not hold. */
export const MODEL = { summary: "Pay", fields: { amount_vnd: 4_900_000 }, amount_vnd: 4_900_000 }

/** The work item of a supplier payment the decider judges. */
export const DECIDED_ITEM = itemOf({
    id: "item-9",
    action: "pay_supplier",
    subject_type: "order",
    subject_id: "payment-1",
    installation_id: "inst-1",
})

/** A walk that ended on a hand-over to another action. */
export const DIVERT_WALK: Walk = {
    outcome: "divert",
    path: ["decide", "hand"],
    branchKey: "else",
    approver: null,
    divert: { action: "hand_over_conversation", handoverTo: "support", asks: false },
    unread: [],
    unjudged: null,
}

/** A walk of an action no node holds. */
export const UNHELD_WALK: Walk = {
    outcome: "unheld",
    path: [],
    branchKey: "",
    approver: null,
    divert: null,
    unread: [],
    unjudged: "not_in_graph",
}

/** A walk that stopped after a fact could not be read. */
export const STOP_WALK: Walk = {
    outcome: "stop",
    path: ["decide", "stop"],
    branchKey: "else",
    approver: null,
    divert: null,
    unread: ["supplier_payment.kind"],
    unjudged: "fact_unread",
}

/** A work item put in front of the decider, with the gate the spec names. */
export const requestOf = (gate: BranchRequest["gate"], overrides: Partial<BranchRequest> = {}): BranchRequest => ({
    workspaceId: "ws-1",
    item: DECIDED_ITEM,
    proposal: MODEL,
    gate,
    turnId: "turn-1",
    wakeId: "wake-1",
    ...overrides,
})
