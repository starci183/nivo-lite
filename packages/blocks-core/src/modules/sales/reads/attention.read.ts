import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListPage, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { attentionRowsOf } from "../../../rules/sales/decisions"
import type { AttentionRow } from "../../../rules/sales/decisions"
import { SALES_VIEW } from "../constants"
import { salesLeadStore, salesOrderStore, salesSettings } from "../ports"
import { waitingOrdersOf } from "./waiting-orders"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `sales.attention`: what needs the owner now, one row per order that waits, each with the row action of the list. */
export const attentionRead: ReadDefinition = defineRead({
    id: "sales.attention",
    dataKind: "sales-attention",
    shape: "list",
    fields: ["id", "title", "description", "reason"],
    paths: { rows: "list" },
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeadStore, orders: salesOrderStore, settings: salesSettings },
    run: async (stores): Promise<ListPage<AttentionRow>> => ({
        rows: attentionRowsOf((await waitingOrdersOf(stores)).rows),
        cursor: null,
    }),
})
