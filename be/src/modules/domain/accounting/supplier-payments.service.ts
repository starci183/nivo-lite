import { Injectable } from "@nestjs/common"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import type { GatewayPayable, HubCardPayload, HubCardRef, UnclearPayment } from "./accounting-desk.contracts"
import { AccountingDecisionsService, supplierPaymentKey } from "./accounting-decisions.service"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { toolSources } from "./card-sources.policy"
import { CARD_COPY, SUPPLIER_COPY } from "./messages/accounting-desk.messages"
import { matchPayables } from "./payable-match.policy"

/** How far back the outgoing payments are read: the same window as the open payables. */
const DEBIT_WINDOW_DAYS = 60
const DAY_MS = 86_400_000

const unclearCard = (unclear: UnclearPayment, ref: HubCardRef, tool: string | null): HubCardPayload => ({
    v: 1,
    type: "exception",
    title: SUPPLIER_COPY.title(unclear.payable.supplier, unclear.payable.invoiceNo),
    badge: SUPPLIER_COPY.badge,
    body: SUPPLIER_COPY.body,
    fields: [
        { label: SUPPLIER_COPY.invoiceAmount, value: CARD_COPY.money(unclear.payable.amountVnd) },
        { label: SUPPLIER_COPY.paid, value: CARD_COPY.money(unclear.debit.amountVnd) },
        { label: SUPPLIER_COPY.memo, value: unclear.debit.reference },
    ],
    data: {
        invoiceNo: unclear.payable.invoiceNo,
        sellerTaxCode: unclear.payable.sellerTaxCode,
        debitRef: unclear.debit.creditRef,
    },
    ref,
    actions: ["approve", "decline"],
    sources: toolSources([{ tool, label: CARD_COPY.sourceDebits }]),
})

@Injectable()
/**
 * Which supplier invoices are still to pay. The outgoing payments come from the workspace's `payment.debits.list` tool, by
 * capability role: a payment of the exact amount whose memo names the invoice number pays the invoice, so it stops reminding. A
 * payment that only partly matches (the amount, or the number) is opened once as a decision for the chief accountant, with its
 * card in the accounting room; once approved the invoice counts as paid, until then (and after a decline) it keeps reminding.
 */
export class SupplierPaymentsService {
    constructor(
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly items: WorkItemsService,
        private readonly decisions: AccountingDecisionsService,
        private readonly room: AccountingRoomService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The supplier invoices still to pay this morning. */
    async openPayables(workspaceId: string): Promise<ReadonlyArray<GatewayPayable>> {
        const payables = await this.gateway.listOpenPayables(workspaceId)
        if (payables.length === 0) return []
        const since = new Date(this.clock.now().getTime() - DEBIT_WINDOW_DAYS * DAY_MS).toISOString()
        const debits = await this.gateway.listPaymentDebits(workspaceId, since)
        const matches = matchPayables(payables, debits.value)
        const confirmed = new Set<string>()
        await eachInOrder(matches.unclear, async (unclear) => {
            if (await this.confirmed(workspaceId, unclear, debits.tool))
                confirmed.add(supplierPaymentKey(unclear.payable))
        })
        return matches.open.filter((payable) => !confirmed.has(supplierPaymentKey(payable)))
    }

    /** Whether a person already confirmed the payment; the first time, it opens the decision and posts its card. */
    private async confirmed(workspaceId: string, unclear: UnclearPayment, tool: string | null): Promise<boolean> {
        const asked = await this.items.findByDedupe(workspaceId, supplierPaymentKey(unclear.payable))
        if (asked !== null) return asked.status === "done"
        const { payable, debit } = unclear
        const text = SUPPLIER_COPY.text(payable.supplier, payable.invoiceNo, payable.amountVnd, debit.amountVnd)
        const ref = await this.decisions.askSupplierPayment(workspaceId, { ...unclear, summary: text })
        await this.room.postCard(workspaceId, unclearCard(unclear, ref, tool), text)
        return false
    }
}
