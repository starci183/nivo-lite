import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListQuery, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { salesFiguresOf } from "../../../rules/sales/figures"
import type { SalesFigures } from "../../../rules/sales/figures"
import { SALES_VIEW } from "../constants"
import { salesLeadsList, salesOrdersList } from "../ports"
import { LEADS_LIST } from "./leads.read"
import { ORDERS_LIST } from "./orders.read"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most orders the figures add up. */
export const FIGURE_ORDERS_MAX = 500

const EVERYTHING: ListQuery = { q: null, filters: {}, sort: "recent", cursor: null, size: FIGURE_ORDERS_MAX }

/** `sales.figures`: the open customers, the value on offer, the orders closed and the won share, over the whole workspace. */
export const figuresRead: ReadDefinition = defineRead({
    id: "sales.figures",
    dataKind: "sales-figures",
    shape: "record",
    fields: ["openCount", "proposalCount", "proposalValueVnd", "closedCount", "closedValueVnd", "conversion"],
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeadsList, orders: salesOrdersList },
    run: async ({ leads, orders }): Promise<SalesFigures> =>
        salesFiguresOf(
            await leads.counts(LEADS_LIST, "stage", EVERYTHING),
            (await orders.page(ORDERS_LIST, EVERYTHING)).rows,
        ),
})
