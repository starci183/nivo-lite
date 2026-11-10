import { defineDataKind } from "@nivo-lite/agent-sdk/node"
import type { DataKindDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ENTRIES, MAX_ID, MAX_LINE } from "../bounds"
import { boundedRecord } from "../json.schema"

const id = z.string().max(MAX_ID)
const text = z.string().max(MAX_LINE)
const longText = z.string().max(MAX_BODY)
const nullableText = text.nullable()
const moment = z.string().max(MAX_ID)
const amount = z.number().nullable()
const orderLine = z.object({
    name: text,
    qty: z.number(),
    unitVnd: z.number(),
    amountVnd: z.number(),
})

/** A sales order. */
export const orderKind: DataKindDefinition = defineDataKind({
    kind: "order",
    title: { key: "dataKindOrder" },
    fields: z.object({
        id,
        orderNo: text,
        leadId: id,
        items: z.object({ lines: z.array(orderLine).max(MAX_ENTRIES) }),
        itemsText: longText,
        amountVnd: amount,
        status: text,
        note: nullableText,
        recipientName: nullableText,
        recipientPhone: nullableText,
        deliveryAddress: nullableText,
        deliveryAt: nullableText,
        confirmedAt: moment.nullable(),
        shippedAt: moment.nullable(),
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
        consultStage: nullableText,
    }),
})

/** An item the shop sells. */
export const catalogueItemKind: DataKindDefinition = defineDataKind({
    kind: "catalogue-item",
    title: { key: "dataKindCatalogueItem" },
    fields: z.object({
        id,
        sku: nullableText,
        name: text,
        unit: nullableText,
        priceVnd: amount,
        active: z.boolean(),
        imageUrl: nullableText,
        imageType: nullableText,
    }),
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
        direction: text,
        externalRef: nullableText,
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
        // As the claim record stores it (`{ values }`: a jsonb field holds no bare list); a plain list is read too.
        names: z.union([z.object({ values: z.array(text).max(MAX_ENTRIES) }), z.array(text).max(MAX_ENTRIES)]),
        body: longText,
        claimedAt: moment,
        status: text,
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
    fields: z.object({
        id,
        conversationId: id,
        authorKind: text,
        body: longText,
        createdAt: moment,
        role: text,
        text: longText,
        sentAt: moment,
        status: text,
    }),
})

/** A document of the business brain; a customer turn reads only the public ones. */
export const knowledgeDocumentKind: DataKindDefinition = defineDataKind({
    kind: "knowledge-document",
    title: { key: "dataKindKnowledgeDocument" },
    fields: z.object({ id, title: text, body: longText, visibility: z.enum(["public", "internal"]) }),
})

/** The permission level the owner set for one action of the agent's module: `auto` runs alone, `ask` waits for a person, `never` does not run. */
export const authorityRuleKind: DataKindDefinition = defineDataKind({
    kind: "authority-rule",
    title: { key: "dataKindAuthorityRule" },
    fields: z.object({ id, action: text, mode: z.enum(["auto", "ask", "never"]) }),
})

/**
 * One entry of a customer's lead memory, as care reads it: the facts entry (`<subject>|$lead|$facts`) holds what the consult learned
 * (`careOptOut`, `occasions`, `recipientName`, `deliveryAt`, `address`) under `output.value`. Read by its key only.
 */
export const leadMemoryKind: DataKindDefinition = defineDataKind({
    kind: "agent-lead-memory",
    title: { vi: "Trí nhớ khách", en: "Customer memory" },
    fields: z.object({ id, entryKey: text, leadId: id.nullable(), kind: text, output: boundedRecord }),
})

/** Every data kind the core nodes may hold rights over; the back end registers a data port for each. */
export const coreDataKinds: ReadonlyArray<DataKindDefinition> = [
    orderKind,
    salesLeadKind,
    catalogueItemKind,
    bankTransactionKind,
    paymentClaimKind,
    conversationKind,
    messageKind,
    knowledgeDocumentKind,
    authorityRuleKind,
    leadMemoryKind,
]
