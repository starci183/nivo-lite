import { defineRead, type ListPage, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { awaitingRowsOf, type AttentionItem } from "../rules/attention"
import { OPEN_STAGES } from "../rules/stage"
import { SALES_VIEW } from "../constants"
import { salesLeads } from "../ports"
import { LEAD_FIELDS, leadRowsOf } from "../sales-records"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most rows an attention list holds. */
export const ATTENTION_SHOWN = 20

/** `blocks-core.sales.api.lead.awaiting-reply`: the open customers who wait for an answer, longest wait first. */
export const awaitingReplyRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.lead.awaiting-reply",
    dataKind: "sales-awaiting-reply",
    shape: "list",
    fields: ["id", "title", "description", "reason", "at"],
    paths: { rows: "list" },
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeads },
    run: async ({ leads }): Promise<ListPage<AttentionItem>> => {
        const page = await leads.list({
            select: LEAD_FIELDS,
            where: q.and(q.notNull("awaitingSince"), q.in("stage", OPEN_STAGES)),
            order: [
                ["awaitingSince", "asc"],
                ["id", "asc"],
            ],
            page: { size: ATTENTION_SHOWN },
        })
        return {
            rows: awaitingRowsOf(leadRowsOf(page.rows)),
            cursor: null,
        }
    },
})
