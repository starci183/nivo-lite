import { createHash } from "node:crypto"
import type { GraphCheck } from "@modules/domain/authority-rules"
import type { CustomerTurn } from "@modules/domain/conversations"
import type { WorkItem } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { AMOUNT_EVIDENCE, type GraphEvidence, type ReasonCode } from "@modules/domain/work-items"
import type { CapturedOrder, CustomerReply, HumanReason } from "./customer-turns.contracts"

/** The action whose rule says whether a reply leaves alone. */
export const REPLY_ACTION = "reply_customer"

/** A waiting answer to open for a person. */
export interface ReplyItemSpec {
    /** One item per customer message and purpose. */
    readonly dedupeKey: string
    /** What the customer asked. */
    readonly question: string
    /** The answer a person may approve, or empty. */
    readonly draft: string
    /** Why a person decides. */
    readonly forceAsk: ReasonCode
    /** The customer, when known. */
    readonly leadId: string | null
    /** What the turn knows, shown to the person who approves. */
    readonly evidence?: ReadonlyArray<GraphEvidence>
}

/** A waiting answer, and whether an earlier delivery of the turn had already opened it. */
export interface OpenedReplyItem {
    /** The item. */
    readonly item: WorkItem
    /** True when it existed before this call. */
    readonly existed: boolean
}

/** The reply as the gate will judge it, after the price and payment rules. */
export interface Judged {
    /** The text that leaves. */
    readonly reply: string
    /** True when a person must answer. */
    readonly needsHuman: boolean
    /** Why, or null. */
    readonly reason: HumanReason | null
    /** The order to record, or null. */
    readonly order: CapturedOrder | null
    /** The open invoice the customer says they paid, or null. */
    readonly claimOpen: InvoiceRow | null
    /** The invoice the books hold as paid lately, or null. */
    readonly paid?: InvoiceRow | null
}

/** What a reply is judged with: the customer as known now and what the turn knows. */
export interface ReplyScope {
    /** What the reply answers: the customer message, or the work item of an output. */
    readonly key: string
    /** The customer, or null. */
    readonly leadId: string | null
    /** What the turn knows. */
    readonly evidence: ReadonlyArray<GraphEvidence>
}

const amountEntry = (kind: string, via: string, value: number | null): GraphEvidence => ({
    key: AMOUNT_EVIDENCE,
    value,
    kind,
    via,
})

/**
 * What a turn knows of money: an order on its record and a claim of payment are claims, and an invoice the books hold as paid is money
 * received. A turn about none of these has no entry and reads 0; a claim with no invoice behind it is an entry with no amount, and waits.
 */
export const evidenceOfTurn = (
    reply: CustomerReply,
    judged: Judged,
    orderAmountVnd: number | null,
): ReadonlyArray<GraphEvidence> => {
    const claimed = judged.claimOpen?.amount_vnd
    const received = judged.paid?.amount_vnd
    const unmatched = reply.paymentClaim && claimed === undefined && received === undefined
    return [
        ...(reply.order === null ? [] : [amountEntry("claimed", "order_record", orderAmountVnd)]),
        ...(claimed === undefined ? [] : [amountEntry("claimed", "chat_text", claimed)]),
        ...(received === undefined ? [] : [amountEntry("received", "invoice_paid", received)]),
        ...(unmatched ? [amountEntry("claimed", "chat_text", null)] : []),
    ]
}

/** The check of the text that really leaves: one per customer message and text, so a redelivery is one run and a new draft is judged anew. */
export const replyCheckOf = (turn: CustomerTurn, reply: string, scope: ReplyScope): GraphCheck => {
    const { conversation, origin } = turn
    return {
        workspaceId: conversation.workspaceId,
        installationId: conversation.installationId,
        action: REPLY_ACTION,
        road: "reply",
        key: `${scope.key}:${createHash("sha256").update(reply).digest("hex")}`,
        subjectType: "conversation",
        subjectId: conversation.id,
        leadId: scope.leadId,
        text: reply,
        evidence: scope.evidence,
        attributes: {},
        turnId: origin?.turnId ?? null,
        wakeId: origin?.wakeId ?? null,
        askOpensWork: true,
    }
}
