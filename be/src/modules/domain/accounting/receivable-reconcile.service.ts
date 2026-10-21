import { Injectable } from "@nestjs/common"
import type { HubCardPayload, HubCardRef } from "./accounting-desk.contracts"
import { AccountingDecisionsService } from "./accounting-decisions.service"
import { AccountingRoomService } from "./accounting-room.service"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway, PaymentCredit, ReceivableMatch, ReceivableSnapshot } from "./accounting-gateway.port"
import { toolSources } from "./card-sources.policy"
import { CARD_COPY, RECEIVABLE_COPY, receivableMatchText } from "./messages/accounting-desk.messages"
import { matchReceivable } from "./receivable-match.policy"

/** A receivable match other than an exact payment. */
export type ReceivableMismatch = Exclude<ReceivableMatch, "exact">

/** What happened to one credit, and the `receivable.find` tool that answered (null when none did). */
export interface ReconcileOutcome {
    /** `no_reference`, `unknown`, `recorded`, `record_failed` or `mismatch`. */
    readonly kind: "no_reference" | "unknown" | "recorded" | "record_failed" | "mismatch"
    /** How the amount differed, for a mismatch. */
    readonly match?: ReceivableMismatch
    /** The `receivable.find` tool that answered, cited by the morning card. */
    readonly tool: string | null
}

/** The tools of one reconciliation: where the credit came from and where its receivable was found. */
interface ReconcileTools {
    /** The `payment.credits.list` tool. */
    readonly credits: string | null
    /** The `receivable.find` tool. */
    readonly receivables: string | null
}

const mismatchCard = (
    receivable: ReceivableSnapshot,
    credit: PaymentCredit,
    match: ReceivableMismatch,
    tools: ReconcileTools,
    ref: HubCardRef,
): HubCardPayload => ({
    v: 1,
    type: "exception",
    title: RECEIVABLE_COPY.title(credit.reference),
    badge: receivableMatchText(match),
    body: RECEIVABLE_COPY.body,
    fields: [
        { label: RECEIVABLE_COPY.received, value: CARD_COPY.money(credit.amountVnd) },
        { label: RECEIVABLE_COPY.balance, value: CARD_COPY.money(receivable.balanceVnd) },
        { label: RECEIVABLE_COPY.memo, value: credit.reference },
    ],
    data: { receivableId: receivable.receivableId, creditRef: credit.creditRef },
    ref,
    actions: ["approve", "decline"],
    sources: toolSources([
        { tool: tools.credits, label: CARD_COPY.sourceCredits },
        { tool: tools.receivables, label: CARD_COPY.sourceReceivables },
    ]),
})

@Injectable()
/**
 * N23: each unmatched payment credit is matched to the open receivable its memo names, by the workspace's `receivable.find` tool
 * (the connector reads its own reference format; the memo is passed as the payer wrote it). An exact payment of the balance is
 * recorded with `receivable.recordPayment` and reported in the accounting room; any other amount is opened as a decision for the
 * chief accountant (approving it records the credit, declining it keeps the reason) and shown as an exception card with its
 * approve and decline buttons; nothing is recorded until then.
 */
export class ReceivableReconcileService {
    constructor(
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly room: AccountingRoomService,
        private readonly decisions: AccountingDecisionsService,
    ) {}

    /** Matches one credit read by the `creditsTool`; a credit without a memo, or whose memo names no receivable, is left as it is. */
    async reconcile(workspaceId: string, credit: PaymentCredit, creditsTool: string | null): Promise<ReconcileOutcome> {
        const reference = credit.reference.trim()
        if (reference === "") return { kind: "no_reference", tool: null }
        const found = await this.gateway.findReceivable(workspaceId, reference)
        const receivable = found.value
        if (receivable === null) return { kind: "unknown", tool: found.tool }
        const match = matchReceivable(receivable, credit.amountVnd)
        if (match !== "exact") {
            const text = RECEIVABLE_COPY.text(reference, credit.amountVnd, receivable.balanceVnd)
            const ref = await this.decisions.askPayment(workspaceId, { receivable, credit, summary: text })
            const tools = { credits: creditsTool, receivables: found.tool }
            const card = mismatchCard(receivable, { ...credit, reference }, match, tools, ref)
            await this.room.postCard(workspaceId, card, text)
            return { kind: "mismatch", match, tool: found.tool }
        }
        const payment = {
            receivableId: receivable.receivableId,
            creditRef: credit.creditRef,
            amountVnd: credit.amountVnd,
        }
        const recorded = await this.gateway.recordPayment(workspaceId, payment)
        await this.room.post(
            workspaceId,
            recorded
                ? RECEIVABLE_COPY.recorded(reference, credit.amountVnd, credit.creditRef)
                : RECEIVABLE_COPY.failed(reference, credit.creditRef),
        )
        return { kind: recorded ? "recorded" : "record_failed", tool: found.tool }
    }
}
