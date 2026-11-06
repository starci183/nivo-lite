import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListPage, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { failedRowsOf } from "../../../rules/sales/attention"
import type { AttentionItem } from "../../../rules/sales/attention"
import { SALES_VIEW } from "../constants"
import { salesLeadStore, salesOrderStore } from "../ports"
import { ATTENTION_SHOWN } from "./awaiting-reply.read"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `sales.failed-steps`: the orders whose follow-up step failed, newest first, with the customer's name. */
export const failedStepsRead: ReadDefinition = defineRead({
    id: "sales.failed-steps",
    dataKind: "sales-failed-step",
    shape: "list",
    fields: ["id", "title", "description", "reason", "at"],
    paths: { rows: "list" },
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeadStore, orders: salesOrderStore },
    run: async ({ leads, orders }): Promise<ListPage<AttentionItem>> => {
        const failed = await orders.failedSteps(ATTENTION_SHOWN)
        const leadIds = failed.flatMap((order) => (order.leadId === null ? [] : [order.leadId]))
        const names = leadIds.length === 0 ? {} : await leads.names([...new Set(leadIds)])
        const byOrder = Object.fromEntries(
            failed.flatMap((order) => {
                const name = order.leadId === null ? undefined : names[order.leadId]
                return name === undefined ? [] : [[order.id, name] as const]
            }),
        )
        return { rows: failedRowsOf(failed, byOrder), cursor: null }
    },
})
