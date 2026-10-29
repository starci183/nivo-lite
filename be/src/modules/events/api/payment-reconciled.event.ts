import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isAmountOrNull, isKey, isTextOrNull, openEnvelope } from "./money-event.policy"

/**
 * The payload of the `payment_reconciled` event: a payment settled one invoice (it is paid, the order is paid, the bank transaction is
 * matched). A reactor reads the current state of what it acts on and takes only identities and display facts from here. `dedupeKey`
 * is the invoice id: an invoice is settled once.
 */
export interface PaymentReconciledInput {
    /** The workspace of the invoice. */
    readonly workspaceId: string
    /** The settled invoice; equals `dedupeKey`. */
    readonly invoiceId: string
    /** The invoice number shown to people. */
    readonly invoiceNo: string
    /** The paid amount in VND. */
    readonly amountVnd: number | null
    /** The instant the invoice was paid (ISO), or null. */
    readonly paidAt: string | null
    /** The bank transaction the payment came as, or null for a customer's claim with no transaction. */
    readonly transactionId: string | null
    /** The work item that reconciled the payment: its evidence trail and chain continue from here. */
    readonly workItemId: string
    /** The subject type of that work item (`transaction` or `invoice`), or null. */
    readonly subjectType: string | null
    /** The subject id of that work item, or null. */
    readonly subjectId: string | null
    /** The order the invoice belongs to, or null. */
    readonly orderId: string | null
    /** The order number, or null. */
    readonly orderNo: string | null
    /** The customer, or null. */
    readonly leadId: string | null
    /** The customer's name as shown. */
    readonly customer: string
    /** The channel the customer came through, or null. */
    readonly channel: string | null
    /** The renewed contract when the invoice is a renewal, or null. */
    readonly contractId: string | null
    /** The end of the term the renewal invoice pays (day), or null. */
    readonly periodEndsOn: string | null
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface PaymentReconciledPayload extends EventPayload, PaymentReconciledInput {}

/** Version 1 of `payment_reconciled`, published by the reconcile-payment work in the transaction that marks an invoice paid. */
export class PaymentReconciledEvent extends BaseEvent {
    static readonly eventName = "payment_reconciled"
    static readonly version = 1

    readonly eventName = PaymentReconciledEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: PaymentReconciledPayload,
    ) {
        super()
    }

    /** The invoice id is the identity of the fact: an invoice is settled once. */
    static create(payload: PaymentReconciledInput): PaymentReconciledEvent {
        return new PaymentReconciledEvent(payload.invoiceId, { ...payload, dedupeKey: payload.invoiceId })
    }

    /** Reads the event envelope; a malformed delivery never reaches a reactor. */
    static parse(envelope: unknown): ParsedEvent<PaymentReconciledEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        if (
            !isKey(body.invoiceId) ||
            !isKey(body.workspaceId) ||
            !isKey(body.workItemId) ||
            typeof body.invoiceNo !== "string" ||
            typeof body.customer !== "string" ||
            !isAmountOrNull(body.amountVnd) ||
            !isTextOrNull(body.paidAt) ||
            !isTextOrNull(body.transactionId) ||
            !isTextOrNull(body.subjectType) ||
            !isTextOrNull(body.subjectId) ||
            !isTextOrNull(body.orderId) ||
            !isTextOrNull(body.orderNo) ||
            !isTextOrNull(body.leadId) ||
            !isTextOrNull(body.channel) ||
            !isTextOrNull(body.contractId) ||
            !isTextOrNull(body.periodEndsOn)
        ) {
            return null
        }
        return new PaymentReconciledEvent(opened.eventId, {
            dedupeKey: body.invoiceId,
            workspaceId: body.workspaceId,
            invoiceId: body.invoiceId,
            invoiceNo: body.invoiceNo,
            amountVnd: body.amountVnd,
            paidAt: body.paidAt,
            transactionId: body.transactionId,
            workItemId: body.workItemId,
            subjectType: body.subjectType,
            subjectId: body.subjectId,
            orderId: body.orderId,
            orderNo: body.orderNo,
            leadId: body.leadId,
            customer: body.customer,
            channel: body.channel,
            contractId: body.contractId,
            periodEndsOn: body.periodEndsOn,
        })
    }
}
