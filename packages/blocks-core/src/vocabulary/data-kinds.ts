import { defineDataKind } from "@nivo-lite/agent-sdk/node"
import type { DataKindDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ENTRIES, MAX_ID, MAX_LINE } from "../bounds"

const id = z.string().max(MAX_ID)
const text = z.string().max(MAX_LINE)
const longText = z.string().max(MAX_BODY)
const nullableText = text.nullable()
const moment = z.string().max(MAX_ID)
const amount = z.number().nullable()
const orderLine = z.object({
    name: text,
    qty: z.number(),
    unitPriceVnd: z.number().optional(),
    catalogueItemId: id.optional(),
})

/** A sales order. */
export const orderKind: DataKindDefinition = defineDataKind({
    kind: "order",
    title: { key: "dataKindOrder" },
    fields: z.object({
        id,
        orderNo: text,
        leadId: id,
        items: z.array(orderLine).max(MAX_ENTRIES),
        amountVnd: amount,
        status: text,
        note: nullableText,
        confirmedAt: moment.nullable(),
        createdAt: moment,
    }),
})

/** A customer the sales agent works. */
export const salesLeadKind: DataKindDefinition = defineDataKind({
    kind: "sales-lead",
    title: { key: "dataKindSalesLead" },
    fields: z.object({
        id,
        contactName: nullableText,
        company: nullableText,
        channel: nullableText,
        need: nullableText,
        stage: text,
        phone: nullableText,
        email: nullableText,
        contextSummary: nullableText,
    }),
})

/** An item the shop sells. */
export const catalogueItemKind: DataKindDefinition = defineDataKind({
    kind: "catalogue-item",
    title: { key: "dataKindCatalogueItem" },
    fields: z.object({ id, sku: nullableText, name: text, unit: nullableText, priceVnd: amount, active: z.boolean() }),
})

/** A credit or debit the bank feed saw. */
export const bankTransactionKind: DataKindDefinition = defineDataKind({
    kind: "bank-transaction",
    title: { key: "dataKindBankTransaction" },
    fields: z.object({
        id,
        amountVnd: z.number(),
        reference: longText,
        payer: nullableText,
        occurredAt: moment,
        orderId: id.nullable(),
        status: text,
    }),
})

/** What a customer said they paid, before the money is seen. */
export const paymentClaimKind: DataKindDefinition = defineDataKind({
    kind: "payment-claim",
    title: { key: "dataKindPaymentClaim" },
    fields: z.object({
        id,
        leadId: id.nullable(),
        conversationId: id.nullable(),
        amountVnd: amount,
        names: z.array(text).max(MAX_ENTRIES),
        body: longText,
        claimedAt: moment,
        status: text,
    }),
})

/** The account the workspace is paid into, as its bank feed connection holds it. */
export const paymentAccountKind: DataKindDefinition = defineDataKind({
    kind: "payment-account",
    title: { key: "dataKindPaymentAccount" },
    fields: z.object({
        provider: text,
        bankCode: text,
        bankName: text,
        accountNumber: text,
        accountHolder: text,
        connectionId: id,
    }),
})

/** A conversation with a customer on a channel. */
export const conversationKind: DataKindDefinition = defineDataKind({
    kind: "conversation",
    title: { key: "dataKindConversation" },
    fields: z.object({ id, leadId: id.nullable(), channel: text, status: text, lastAt: moment.nullable() }),
})

/** One message of a conversation. */
export const messageKind: DataKindDefinition = defineDataKind({
    kind: "message",
    title: { key: "dataKindMessage" },
    fields: z.object({ id, conversationId: id, authorKind: text, body: longText, createdAt: moment }),
})

/** A document of the business brain; a customer turn reads only the public ones. */
export const knowledgeDocumentKind: DataKindDefinition = defineDataKind({
    kind: "knowledge-document",
    title: { key: "dataKindKnowledgeDocument" },
    fields: z.object({ id, title: text, body: longText, visibility: z.enum(["public", "internal"]) }),
})

/** Every data kind the core nodes may hold rights over; the back end registers a data port for each. */
export const coreDataKinds: ReadonlyArray<DataKindDefinition> = [
    orderKind,
    salesLeadKind,
    catalogueItemKind,
    bankTransactionKind,
    paymentClaimKind,
    paymentAccountKind,
    conversationKind,
    messageKind,
    knowledgeDocumentKind,
]
