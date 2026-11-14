import { defineRead, type ListPage, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { needsRowsOf, overdueRowsOf, ownerRowsOf, type AttentionItem } from "../rules/attention"
import { OPEN_STAGES } from "../rules/stage"
import { SALES_VIEW } from "../constants"
import { salesLeads, salesOrders, salesSettings } from "../ports"
import { LEAD_FIELDS, leadRowsOf } from "../sales-records"
import { ATTENTION_SHOWN } from "./awaiting-reply.read"
import { waitingOrdersOf } from "./waiting-orders"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/**
 * `blocks-core.sales.api.lead.attention`: what needs the owner now besides the customers who wait and the steps that failed: the deals whose next step
 * is past its day, the customers the assistant has a question about, and the orders over the limit. One row each, with the reason
 * as a code the block gives words to.
 */
export const attentionRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.lead.attention",
    dataKind: "sales-attention",
    shape: "list",
    fields: ["id", "title", "description", "reason", "at"],
    paths: { rows: "list" },
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeads, orders: salesOrders, settings: salesSettings },
    run: async ({ leads, orders, settings }, _variables, context): Promise<ListPage<AttentionItem>> => {
        const overdue = await leads.list({
            select: LEAD_FIELDS,
            where: q.and(q.lt("nextDueAt", context.now.toISOString()), q.in("stage", OPEN_STAGES)),
            order: [
                ["nextDueAt", "asc"],
                ["id", "asc"],
            ],
            page: { size: ATTENTION_SHOWN },
        })
        const asking = await leads.list({
            select: LEAD_FIELDS,
            where: q.and(q.notNull("needs"), q.in("stage", OPEN_STAGES)),
            order: [
                ["needs", "asc"],
                ["id", "asc"],
            ],
            page: { size: ATTENTION_SHOWN },
        })
        return {
            rows: [
                ...overdueRowsOf(leadRowsOf(overdue.rows)),
                ...needsRowsOf(leadRowsOf(asking.rows)),
                ...ownerRowsOf((await waitingOrdersOf({ leads, orders, settings })).rows),
            ],
            cursor: null,
        }
    },
})
