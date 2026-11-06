import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListPage, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { awaitingRowsOf } from "../../../rules/sales/attention"
import type { AttentionItem } from "../../../rules/sales/attention"
import { SALES_VIEW } from "../constants"
import { salesLeadStore } from "../ports"

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
    ports: { leads: salesLeadStore },
    run: async ({ leads }): Promise<ListPage<AttentionItem>> => ({
        rows: awaitingRowsOf(await leads.awaitingReply(ATTENTION_SHOWN)),
        cursor: null,
    }),
})
