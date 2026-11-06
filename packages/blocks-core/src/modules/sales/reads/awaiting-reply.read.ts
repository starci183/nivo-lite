import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListPage, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { awaitingRowsOf } from "../../../rules/sales/attention"
import type { AttentionItem } from "../../../rules/sales/attention"
import { OPEN_STAGES } from "../../../rules/sales/stage"
import { SALES_VIEW } from "../constants"
import { salesLeads } from "../ports"
import { LEAD_FIELDS, leadRowsOf } from "../sales-records"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most rows an attention list holds. */
export const ATTENTION_SHOWN = 20

/** `sales.awaiting-reply`: the open customers who wait for an answer, longest wait first. */
export const awaitingReplyRead: ReadDefinition = defineRead({
    id: "sales.awaiting-reply",
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
