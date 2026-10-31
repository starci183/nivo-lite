import { Injectable } from "@nestjs/common"
import { WorkItemsService } from "@modules/domain/work-items"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { SupplierPayablesService, supplierPayableKey } from "@modules/domain/supplier-payables"
import type { SupplierPayableRow } from "@modules/domain/supplier-payables"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    GatewayPayable,
    HubCardPayload,
    HubCardRef,
    PayablePayment,
    SupplierOnFile,
} from "./accounting-desk.contracts"
import { AccountingDecisionsService, supplierPaymentKey } from "./accounting-decisions.service"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { toolSources } from "./card-sources.policy"
import { CARD_COPY, SUPPLIER_COPY } from "./messages/accounting-desk.messages"
import { matchPayables } from "./payable-match.policy"
import { payablesDue } from "./tax-calendar.policy"

/** How far back the outgoing payments are read: the same window as the open payables. */
const DEBIT_WINDOW_DAYS = 60
const DAY_MS = 86_400_000

/** What the due date of a supplier invoice needs: the supplier terms on file and the default term. */
export interface SupplierTerms {
    /** The suppliers on file, with their own payment terms. */
    readonly suppliers: ReadonlyArray<SupplierOnFile>
    /** The term, in days, of a supplier with none of its own. */
    readonly defaultTermDays: number
}

const unclearCard = (unclear: PayablePayment, ref: HubCardRef, tool: string | null): HubCardPayload => ({
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
 * Which supplier invoices are still to pay. Every invoice the workspace's `invoice.list` tool lists is kept as a row
 * (`supplier_payables`), and the outgoing payments come from the `payment.debits.list` tool, by capability role. A payment of the
 * exact amount whose memo names the invoice number goes through the work engine, about the row: the gate and the action graph
 * decide it, and once it passes the row is paid and becomes an expense. A payment that only partly matches (the amount, or the
 * number) always waits for the chief accountant, with its card in the accounting room; until it is approved (and after a
 * decline) the invoice stays open and keeps reminding. This runs on the morning tick only: a screen reads the rows.
 */
export class SupplierPaymentsService {
    constructor(
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly items: WorkItemsService,
        private readonly decisions: AccountingDecisionsService,
        private readonly room: AccountingRoomService,
        private readonly payables: SupplierPayablesService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The supplier invoices still to pay this morning, after the payments that settle them have been decided. */
    async openPayables(workspaceId: string, terms: SupplierTerms): Promise<ReadonlyArray<GatewayPayable>> {
        const listed = await this.gateway.listOpenPayables(workspaceId)
        if (listed.length === 0) return []
        const rows = await this.payables.record(
            workspaceId,
            listed.flatMap((payable) =>
                payablesDue([payable], terms.suppliers, terms.defaultTermDays).map((due) => ({
                    ...payable,
                    dueOn: due.dueOn,
                })),
            ),
        )
        const rowIds = new Map(rows.map((row) => [supplierPayableKey(row), row]))
        const since = new Date(this.clock.now().getTime() - DEBIT_WINDOW_DAYS * DAY_MS).toISOString()
        const debits = await this.gateway.listPaymentDebits(workspaceId, since)
        const matches = matchPayables(listed, debits.value)
        await eachInOrder(matches.paid, (pair) => this.ask(workspaceId, pair, false, rowIds, debits.tool))
        await eachInOrder(matches.unclear, (pair) => this.ask(workspaceId, pair, true, rowIds, debits.tool))
        const stillOpen = new Set((await this.payables.listOpen(workspaceId)).map((row) => supplierPayableKey(row)))
        return listed.filter((payable) => stillOpen.has(supplierPayableKey(payable)))
    }

    /** Opens the decision about a payment once; a row already paid, or a payment already asked about, asks nothing. */
    private async ask(
        workspaceId: string,
        pair: PayablePayment,
        unclear: boolean,
        rows: ReadonlyMap<string, SupplierPayableRow>,
        tool: string | null,
    ): Promise<void> {
        const { payable, debit } = pair
        const row = rows.get(supplierPayableKey(payable))
        if (row === undefined || row.status === "paid") return
        if ((await this.items.findByDedupe(workspaceId, supplierPaymentKey(payable))) !== null) return
        const text = unclear
            ? SUPPLIER_COPY.text(payable.supplier, payable.invoiceNo, payable.amountVnd, debit.amountVnd)
            : SUPPLIER_COPY.exactText(payable.supplier, payable.invoiceNo, payable.amountVnd)
        const ref = await this.decisions.askSupplierPayment(workspaceId, {
            payable,
            debit,
            payableId: row.id,
            unclear,
            summary: text,
        })
        await this.payables.linkWork(workspaceId, row.id, ref.id)
        if (unclear) await this.room.postCard(workspaceId, unclearCard({ payable, debit }, ref, tool), text)
    }
}
