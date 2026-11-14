import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"

/** The order the match recorded paid in one item, as the loop gathered it. */
interface PaidItem {
    readonly orderId: string
    readonly orderNo: string | null
    readonly contactId: string | null
    /** True when a person declined recording this order paid. */
    readonly declined: boolean
}

/** What the match loop gathered: one entry per order compared, the order it recorded paid or null. */
export interface CreditTallyInput {
    /** One entry per paid item: its step key and what that step produced (null when it produced nothing). */
    readonly items: ReadonlyArray<{ readonly key: string; readonly output: PaidItem | null }>
}

/** The order the credit paid, or none. */
export interface CreditTallyOutput {
    /** The order recorded paid, or null when the credit paid none. */
    readonly orderId: string | null
    /** Its code, or null. */
    readonly orderNo: string | null
    /** Its customer, or null. */
    readonly contactId: string | null
    /** True when the credit paid no order because a person declined recording one (`sales.order-paid` declined). */
    readonly declined: boolean
}

/** The most items a match loop gathers (its cap). */
const ITEMS_MAX = 50

const paidItem: NodeSchema<PaidItem> = z.object({
    orderId: z.string().min(1).max(MAX_ID),
    orderNo: z.string().min(1).max(MAX_ID).nullable(),
    contactId: z.string().min(1).max(MAX_ID).nullable(),
    declined: z.boolean(),
})

const input: NodeSchema<CreditTallyInput> = z.object({
    items: z.array(z.object({ key: z.string().min(1).max(MAX_ID), output: paidItem.nullable() })).max(ITEMS_MAX),
})

const output: NodeSchema<CreditTallyOutput> = z.object({
    orderId: z.string().min(1).max(MAX_ID).nullable().describe("The order the credit paid, or null."),
    orderNo: z.string().min(1).max(MAX_ID).nullable().describe("Its code, or null."),
    contactId: z.string().min(1).max(MAX_ID).nullable().describe("Its customer, or null."),
    declined: z.boolean().describe("True when no order was paid because a person declined recording one on its card."),
})

/**
 * `sales.credit-tally` (Ket qua doi soat): reads what the match loop gathered and hands on the order the credit paid (the first item whose
 * paid step ran and was not declined), or none; with none paid it says whether a person declined recording one (`declined`). Plain shaping of the loop's output: the comparisons were the graph's own expressions; the graph routes on this
 * output exactly (`ifNode` on `orderId`).
 */
export const salesCreditTallyNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.credit-tally",
    title: bilingualOf("nodeSalesCreditTallyTitle"),
    description: { vi: "T\u1ed5ng k\u1ebft vi\u1ec7c \u0111\u1ed1i chi\u1ebfu: cho bi\u1ebft kho\u1ea3n ti\u1ec1n v\u1ec1 \u0111\u00e3 tr\u1ea3 cho \u0111\u01a1n n\u00e0o, ho\u1eb7c ch\u01b0a kh\u1edbp \u0111\u01a1n n\u00e0o.", en: "Wraps up the matching: says which order the payment settled, or that it matched none." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    run: (given) => {
        const ran = given.items.flatMap((one) => (one.output === null ? [] : [one.output]))
        const first = ran.find((one) => !one.declined)
        return Promise.resolve(
            first === undefined
                ? { orderId: null, orderNo: null, contactId: null, declined: ran.length > 0 }
                : { orderId: first.orderId, orderNo: first.orderNo, contactId: first.contactId, declined: false },
        )
    },
    examples: [
        {
            name: "the order the credit paid is handed on",
            params: {},
            input: {
                items: [
                    { key: "o2", output: null },
                    { key: "o1", output: { orderId: "o1", orderNo: "DH-20261113-0001", contactId: "contact-1", declined: false } },
                ],
            },
            output: { orderId: "o1", orderNo: "DH-20261113-0001", contactId: "contact-1", declined: false },
        },
        {
            name: "a credit that paid no order hands on none",
            params: {},
            input: { items: [{ key: "o2", output: null }] },
            output: { orderId: null, orderNo: null, contactId: null, declined: false },
        },
        {
            name: "a credit whose order a person declined to record paid hands on none, and says declined",
            params: {},
            input: { items: [{ key: "o1", output: { orderId: "o1", orderNo: null, contactId: null, declined: true } }] },
            output: { orderId: null, orderNo: null, contactId: null, declined: true },
        },
    ],
})
