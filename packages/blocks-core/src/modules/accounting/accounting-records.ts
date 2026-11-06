import type { ListedRecord, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../bounds"
import type {
    AdjustmentRecord,
    BookEntryRecord,
    ClaimRecord,
    InvoiceRecord,
    OrderRecord,
    TransactionRecord,
} from "../../rules/accounting/accounting.types"
import { ENTRY_STATUSES } from "../../rules/accounting/entry-status"
import type { OpenInvoice } from "../../rules/accounting/figures"
import type { QuestionLine } from "../../rules/accounting/questions"
import {
    ACCOUNTING_SETTINGS_DEFAULTS,
    REMATCH_DAYS_MAX,
    REMATCH_DAYS_MIN,
    VAT_PERIODS,
    VOID_MODES,
} from "../../rules/accounting/settings"
import type { AccountingSettings } from "../../rules/accounting/settings"

/** The longest ISO 8601 text the engine writes for a time or a day. */
const MAX_TIME = 40

/** The longest note of an adjustment or a book entry. */
const MAX_NOTE = 2_000

/** The most money one amount holds, in VND. */
const MAX_MONEY = 1_000_000_000_000

/** A value or null, read as null when the engine left the key out. */
const orNull = <T extends z.ZodType>(schema: T) =>
    schema
        .nullable()
        .optional()
        .transform((value) => value ?? null)

const nullableText = (max: number) => orNull(z.string().max(max))

const money = z.number().int().min(0).max(MAX_MONEY)

/** The declared fields of a `payment.transaction` record the module reads. */
const transactionData = z.object({
    direction: z.enum(["credit", "debit"]),
    amountVnd: money,
    reference: nullableText(MAX_LINE),
    payer: nullableText(MAX_LINE),
    orderId: nullableText(MAX_ID),
    occurredAt: z.string().max(MAX_TIME),
    status: z.enum(["unmatched", "matched", "needs_review", "other_income"]),
})

/** The declared fields of a `sales.order` record the module reads. */
const orderData = z.object({
    orderNo: z.string().max(MAX_ID),
    amountVnd: orNull(money),
    status: z.enum(["draft", "confirmed", "invoiced", "paid", "cancelled"]),
})

/** The declared fields of a `payment.claim` record the module reads. */
const claimData = z.object({
    leadId: nullableText(MAX_ID),
    amountVnd: orNull(money),
    status: z.enum(["open", "settled", "escalated", "withdrawn"]),
    settledTransactionId: nullableText(MAX_ID),
})

/** The declared fields of an `accounting.invoice` record the module reads. */
const invoiceData = z.object({
    invoiceNo: z.string().max(MAX_ID),
    amountVnd: money,
    status: z.enum(["draft", "issued", "paid", "void"]),
    dueAt: nullableText(MAX_TIME),
    issuedAt: nullableText(MAX_TIME),
    paidAt: nullableText(MAX_TIME),
})

/** The declared fields of an `accounting.adjustment` record the module reads. */
const adjustmentData = z.object({
    targetType: z.enum(["invoice", "transaction"]),
    targetId: z.string().max(MAX_ID),
    note: z.string().max(MAX_NOTE),
    correctedAmountVnd: orNull(money),
    createdBy: z.string().max(MAX_LINE),
})

/** The declared fields of an `accounting.book-entry` record the module reads. */
const bookEntryData = z.object({
    kind: z.enum(["income", "expense", "invoice", "reversal", "adjustment"]),
    sourceEntity: z.string().max(MAX_ID),
    sourceId: z.string().max(MAX_ID),
    entryDate: z.string().max(MAX_TIME),
    amountVnd: money,
    note: nullableText(MAX_NOTE),
    counterparty: nullableText(MAX_LINE),
    status: z.enum(ENTRY_STATUSES),
})

/** The declared fields of a `sales.lead` record the module reads: the customer's name. */
const leadData = z.object({ contactName: z.string().max(MAX_LINE) })

/** The fields a query for transaction rows selects. */
export const TRANSACTION_FIELDS: ReadonlyArray<string> = [
    "direction",
    "amountVnd",
    "reference",
    "payer",
    "orderId",
    "occurredAt",
    "status",
]

/** The fields a query for order rows selects. */
export const ORDER_FIELDS: ReadonlyArray<string> = ["orderNo", "amountVnd", "status"]

/** The fields a query for claim rows selects. */
export const CLAIM_FIELDS: ReadonlyArray<string> = ["leadId", "amountVnd", "status", "settledTransactionId"]

/** The fields a query for invoice rows selects. */
export const INVOICE_FIELDS: ReadonlyArray<string> = ["invoiceNo", "amountVnd", "status", "dueAt", "issuedAt", "paidAt"]

/** The fields a query for the customer behind a record selects. */
export const LEAD_NAME_FIELDS: ReadonlyArray<string> = ["contactName"]

/** The transaction a record holds; null when its fields are not those of a transaction. */
export const transactionOf = (record: RecordRow): TransactionRecord | null => {
    const parsed = transactionData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

/** The order a listed record holds, with the id of its lead joined in; null when its fields are not those of an order. */
export const orderOf = (listed: ListedRecord): OrderRecord | null => {
    const parsed = orderData.safeParse(listed.row.data)
    return parsed.success
        ? {
              id: listed.row.id,
              version: listed.row.version,
              ...parsed.data,
              leadId: listed.joined["lead"]?.id ?? null,
          }
        : null
}

/** The claim a listed record holds, with the ids of its order and its conversation joined in; null when its fields are not those of a claim. */
export const claimOf = (listed: ListedRecord): ClaimRecord | null => {
    const parsed = claimData.safeParse(listed.row.data)
    return parsed.success
        ? {
              id: listed.row.id,
              version: listed.row.version,
              ...parsed.data,
              orderId: listed.joined["order"]?.id ?? null,
              conversationId: listed.joined["conversation"]?.id ?? null,
          }
        : null
}

/** The name of the customer a joined `sales.lead` record holds; null when there is no link or no name. */
export const customerOf = (listed: ListedRecord): string | null => {
    const joined = listed.joined["lead"]
    const parsed = joined === undefined || joined === null ? null : leadData.safeParse(joined.data)
    return parsed?.success === true ? parsed.data.contactName : null
}

/** The invoice a listed record holds, with its customer's name joined in; null when its fields are not those of an invoice. */
export const invoiceOf = (listed: ListedRecord): InvoiceRecord | null => {
    const parsed = invoiceData.safeParse(listed.row.data)
    return parsed.success
        ? {
              id: listed.row.id,
              ...parsed.data,
              createdAt: listed.row.createdAt,
              customer: customerOf(listed),
          }
        : null
}

/** The part of an open invoice the ageing reads; null when the record is not an invoice. */
export const openInvoiceOf = (record: RecordRow): OpenInvoice | null => {
    const parsed = invoiceData.safeParse(record.data)
    return parsed.success
        ? {
              amountVnd: parsed.data.amountVnd,
              dueAt: parsed.data.dueAt,
              issuedAt: parsed.data.issuedAt,
              createdAt: record.createdAt,
          }
        : null
}

/** The correction a record holds; null when its fields are not those of a correction. */
export const adjustmentOf = (record: RecordRow): AdjustmentRecord | null => {
    const parsed = adjustmentData.safeParse(record.data)
    return parsed.success ? { id: record.id, ...parsed.data, createdAt: record.createdAt } : null
}

/** The book entry a record holds; null when its fields are not those of a book entry. */
export const bookEntryOf = (record: RecordRow): BookEntryRecord | null => {
    const parsed = bookEntryData.safeParse(record.data)
    return parsed.success ? { id: record.id, version: record.version, ...parsed.data } : null
}

/** The name of the customer a `sales.lead` record holds; null when its fields are not a customer's. */
export const leadNameOf = (record: RecordRow): string | null => {
    const parsed = leadData.safeParse(record.data)
    return parsed.success ? parsed.data.contactName : null
}

/** The declared fields of an `accounting.question` record the module reads. */
const questionData = z.object({
    text: z.string().max(MAX_NOTE),
    source: nullableText(MAX_ID),
})

/** The fields a query for question rows selects. */
export const QUESTION_FIELDS: ReadonlyArray<string> = ["text", "source"]

/** The question a record holds, asked at the time the record was made; null when its fields are not those of a question. */
export const questionOf = (record: RecordRow): QuestionLine | null => {
    const parsed = questionData.safeParse(record.data)
    return parsed.success
        ? { id: record.id, text: parsed.data.text, source: parsed.data.source ?? "", askedAt: record.createdAt }
        : null
}

/** The declared fields of an `accounting.settings` record. */
const settingsData = z.object({
    postExpenses: z.boolean(),
    postOutgoing: z.boolean(),
    postUnmatched: z.boolean(),
    voidMode: z.enum(VOID_MODES),
    vatPeriod: z.enum(VAT_PERIODS),
    rematchDays: z.number().int().min(REMATCH_DAYS_MIN).max(REMATCH_DAYS_MAX),
})

/** The fields a query for the settings row selects. */
export const SETTINGS_FIELDS: ReadonlyArray<string> = [
    "postExpenses",
    "postOutgoing",
    "postUnmatched",
    "voidMode",
    "vatPeriod",
    "rematchDays",
]

/** The settings a record holds; the defaults when its fields are not those of the settings. */
export const settingsOfRecord = (record: RecordRow): AccountingSettings => {
    const parsed = settingsData.safeParse(record.data)
    return parsed.success ? parsed.data : ACCOUNTING_SETTINGS_DEFAULTS
}
