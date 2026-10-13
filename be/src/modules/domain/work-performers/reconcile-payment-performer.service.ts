import { Injectable } from "@nestjs/common"
import { AutomationBusinessEventsService } from "@modules/domain/automations"
import { DecisionsError, DecisionsErrorCode, EvidenceService } from "@modules/domain/decisions"
import type {
    Performed,
    PerformedBy,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
} from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import { InvoicesService } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import type { InvoiceRow } from "@modules/domain/invoices"
import { OrdersService } from "@modules/domain/orders"
import { TransactionsService } from "@modules/domain/transactions"
import type { OptionalTransaction } from "@modules/domain/transactions"
import { WorkItemsService } from "@modules/domain/work-items"
import { PerformerKitService } from "./performer-kit.service"
import { leadHref, numberOf, textOf } from "./performer.policy"
import { bankNameOf, candidateOf, claimKeyOf, matchPayment } from "./payment-match.policy"
import type { MatchableInvoice } from "./payment-match.policy"

/** How many of the newest issued invoices a payment is matched against. */
const ISSUED_WINDOW = 50

@Injectable()
/**
 * `reconcile_payment`: Accounting matches an incoming payment (a bank credit or a customer's "I paid") to the invoice it settles. Only a
 * transfer content that names exactly one invoice of the same amount is clear; otherwise the owner chooses among the candidates.
 */
export class ReconcilePaymentPerformerService implements WorkPerformer {
    constructor(
        private readonly kit: PerformerKitService,
        private readonly transactions: TransactionsService,
        private readonly invoices: InvoicesService,
        private readonly orders: OrdersService,
        private readonly inbound: InboundEventsService,
        private readonly workItems: WorkItemsService,
        private readonly evidence: EvidenceService,
        private readonly leads: LeadRecordsService,
        private readonly events: AutomationBusinessEventsService,
    ) {}

    /** Records the payment as unmatched when it has no transaction yet, and offers the invoices it may settle. */
    async prepare(ctx: WorkContext, item: WorkItem): Promise<Prepared> {
        const event = await this.eventOf(ctx, item)
        const transaction = await this.transactionOf(ctx, item, event)
        const amount = event?.amount_vnd ?? transaction.amount_vnd
        const issued = await this.matchables(ctx, item.origin)
        const match = matchPayment(issued, `${transaction.reference ?? ""} ${event?.body ?? ""}`, amount)
        const bank = event === null ? null : bankNameOf(event.channel, event.event_id)
        const payer =
            textOf(transaction.payer) === "" ? this.kit.text(ctx, "reconcileUnknownPayer") : textOf(transaction.payer)
        const reference =
            textOf(transaction.reference) === "" ? this.kit.text(ctx, "reconcileNoRef") : textOf(transaction.reference)
        const money = this.kit.money(ctx, amount)
        const summary =
            bank === null
                ? this.kit.text(ctx, "reconcileSummary", { amount: money, payer, ref: reference })
                : this.kit.text(ctx, "bankCredit", { bank, amount: money, ref: reference, payer })
        const [first] = match.pool
        return {
            proposal: {
                summary,
                amount_vnd: amount,
                outcome: match.clear ? "clear" : "unclear",
                candidates: match.pool.map((invoice) => candidateOf(invoice, this.labelOf(ctx, invoice))),
                fields: {
                    amount_vnd: amount,
                    reference: transaction.reference,
                    payer: transaction.payer,
                    ...(bank === null ? {} : { bank }),
                    ...(match.clear ? { match: this.kit.text(ctx, "matchedByCodeAmount") } : {}),
                },
            },
            patch: {
                subject_type: "transaction",
                subject_id: transaction.id,
                ...(match.clear && first?.leadId !== null && first?.leadId !== undefined
                    ? { lead_id: first.leadId }
                    : {}),
            },
        }
    }

    /** Marks the chosen invoice paid, links the payment, and closes the customer's "I paid" checks the bank credit just made redundant. */
    async perform(ctx: WorkContext, item: WorkItem, proposal: Proposal, by: PerformedBy): Promise<Performed> {
        const [chosen] = proposal.candidates ?? []
        if (chosen === undefined || proposal.candidates?.length !== 1) {
            throw new DecisionsError({ code: DecisionsErrorCode.ChooseCandidate })
        }
        const invoice = await this.invoices.markPaid(ctx.workspaceId, chosen.id, item.origin)
        // A customer's "I paid" claim has no bank transaction of its own (its subject is the invoice).
        if (item.subject_type === "transaction" && item.subject_id !== null) {
            await this.transactions.match(ctx.workspaceId, item.subject_id, invoice.id)
        }
        if (invoice.order_id !== null) await this.orders.markPaid(ctx.workspaceId, invoice.order_id)
        if (item.inbound_event_id !== null)
            await this.inbound.mark(ctx.workspaceId, item.inbound_event_id, null, invoice.lead_id)
        const matched = this.kit.text(ctx, "paymentMatched", {
            amount: this.kit.money(ctx, proposal.amount_vnd ?? null),
            no: invoice.invoice_no,
        })
        const summary = textOf(proposal.fields.bank) === "" ? matched : `${proposal.summary} · ${matched}`
        const how = textOf(proposal.fields.match)
        const reference = textOf(proposal.fields.reference)
        await this.evidence.log(ctx, {
            lead_id: invoice.lead_id,
            work_item_id: item.id,
            kind: "payment.matched",
            actor: by.name,
            summary,
            evidence: [how, reference].filter((part) => part !== "").join(" · ") || null,
        })
        await this.settleClaims(ctx, item, invoice)
        await this.publishReceived(ctx, item, invoice, proposal)
        return {
            summary,
            evidence: "verified",
            href: leadHref(invoice.lead_id),
            lead_id: invoice.lead_id,
            detail: how === "" ? null : how,
        }
    }

    /**
     * `payment.received` for the settled invoice: the pipelines (thank-you, review request, sheet) and webhooks listening hear it. The
     * bank transaction rides along so the receipt pipeline keys this payment the same way the chain's own receipt does (one email).
     */
    private async publishReceived(
        ctx: WorkContext,
        item: WorkItem,
        invoice: InvoiceRow,
        proposal: Proposal,
    ): Promise<void> {
        const payer = invoice.lead_id === null ? null : await this.leads.find(ctx.workspaceId, invoice.lead_id)
        const order = invoice.order_id === null ? null : await this.orders.find(ctx.workspaceId, invoice.order_id)
        await this.events.publish(
            ctx.workspaceId,
            "payment.received",
            {
                invoice_id: invoice.id,
                transaction_id: item.subject_type === "transaction" ? item.subject_id : null,
                invoice_no: invoice.invoice_no,
                order_id: invoice.order_id,
                order_no: order?.order_no ?? null,
                lead_id: invoice.lead_id,
                customer: payer?.contact_name ?? textOf(proposal.fields.payer),
                amount_vnd: proposal.amount_vnd ?? invoice.amount_vnd,
                paid_at: invoice.paid_at,
                channel: payer?.channel ?? null,
            },
            `payment.received:${invoice.id}`,
        )
    }

    /** A rejected payment goes back to the owner's review list. */
    async onReject(ctx: WorkContext, item: WorkItem): Promise<void> {
        if (item.subject_type === "transaction" && item.subject_id !== null) {
            await this.transactions.sendToReview(ctx.workspaceId, item.subject_id)
        }
    }

    private async settleClaims(ctx: WorkContext, item: WorkItem, invoice: InvoiceRow): Promise<void> {
        const summary = this.kit.text(ctx, "claimSettled", { no: invoice.invoice_no })
        const closed = await this.workItems.settleClaims(ctx.workspaceId, item.id, claimKeyOf(invoice.id), {
            summary,
            href: leadHref(invoice.lead_id),
        })
        await Promise.all(
            closed.map(async (row) => {
                if (row.inbound_event_id !== null)
                    await this.inbound.mark(ctx.workspaceId, row.inbound_event_id, "processed", null)
                await this.evidence.log(ctx, {
                    lead_id: invoice.lead_id,
                    work_item_id: row.id,
                    kind: "work.settled",
                    actor: "NIVO",
                    summary,
                })
            }),
        )
    }

    private labelOf(ctx: WorkContext, invoice: MatchableInvoice): string {
        return this.kit.text(ctx, "candidateLabel", {
            no: invoice.invoiceNo,
            name: invoice.name ?? "—",
            amount: this.kit.money(ctx, invoice.amountVnd),
        })
    }

    private async eventOf(ctx: WorkContext, item: WorkItem): Promise<OptionalInboundEvent> {
        return item.inbound_event_id === null ? null : this.inbound.find(ctx.workspaceId, item.inbound_event_id)
    }

    private async transactionOf(ctx: WorkContext, item: WorkItem, event: OptionalInboundEvent) {
        const existing: OptionalTransaction =
            item.subject_type === "transaction" && item.subject_id !== null
                ? await this.transactions.find(ctx.workspaceId, item.subject_id)
                : null
        if (existing !== null) return existing
        return this.transactions.open({
            workspaceId: ctx.workspaceId,
            inboundEventId: item.inbound_event_id,
            amountVnd: event?.amount_vnd ?? numberOf(item.proposal.amount_vnd ?? null) ?? 0,
            reference: event?.external_ref ?? null,
            payer: event?.sender_name ?? null,
            origin: item.origin,
        })
    }

    /** The newest issued invoices with the order number and the customer's name a payment is matched on. */
    private async matchables(ctx: WorkContext, origin: string): Promise<Array<MatchableInvoice>> {
        const issued = await this.invoices.listIssued(ctx.workspaceId, ISSUED_WINDOW, origin)
        return issued.map((invoice) => ({
            id: invoice.id,
            invoiceNo: invoice.invoice_no,
            orderNo: invoice.order_no,
            leadId: invoice.lead_id,
            name: invoice.contact_name,
            amountVnd: invoice.amount_vnd,
        }))
    }
}
