import { defineDataKind, type DataKindDefinition } from "@nivo-lite/agent-sdk/node"
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

/**
 * One line of a conversation with a customer: the ENGINE's line (`platform.customer-messages`, ruling R26), both directions, with the
 * files it carried by address.
 */
export const messageKind: DataKindDefinition = defineDataKind({
    kind: "message",
    title: { key: "dataKindMessage" },
    fields: z.object({
        id,
        routeId: id,
        direction: z.enum(["from_person", "to_person"]),
        text: longText,
        saidAt: moment,
        files: z.array(z.object({ url: longText, name: text, contentType: text })).max(MAX_ENTRIES),
    }),
})

/** A document of the business brain; a customer turn reads only the public ones. */
export const knowledgeDocumentKind: DataKindDefinition = defineDataKind({
    kind: "knowledge-document",
    title: { key: "dataKindKnowledgeDocument" },
    fields: z.object({ id, title: text, body: longText, visibility: z.enum(["public", "internal"]) }),
})

/** Every data kind the core nodes read and write through their data port; the back end registers a data port for each. */
export const coreDataKinds: ReadonlyArray<DataKindDefinition> = [
    orderKind,
    salesLeadKind,
    catalogueItemKind,
    bankTransactionKind,
    paymentClaimKind,
    conversationKind,
    messageKind,
    knowledgeDocumentKind,
]
