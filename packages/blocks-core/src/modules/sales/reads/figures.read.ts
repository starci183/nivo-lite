import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { MeasureValue } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { salesFiguresOf } from "../../../rules/sales/figures"
import type { SalesFigures } from "../../../rules/sales/figures"
import { CONFIRMED_STATUSES } from "../../../rules/sales/order-status"
import { SALES_VIEW } from "../constants"
import { salesLeads, salesOrders } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most stages one count by stage lists. */
const STAGES_MAX = 10

const DRAFT = q.eq("status", "draft")
const CONFIRMED = q.in("status", CONFIRMED_STATUSES)

/** `sales.figures`: the open customers, the value on offer, the orders closed and the won share, over the whole workspace. */
export const figuresRead: ReadDefinition = defineRead({
    id: "sales.figures",
    dataKind: "sales-figures",
    shape: "record",
    fields: [
        "openCount",
        "proposalCount",
        "proposalValueVnd",
        "closedCount",
        "closedValueVnd",
        "conversion",
        "openHint",
        "proposalHint",
        "closedHint",
        "conversionHint",
    ],
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeads, orders: salesOrders },
    run: async ({ leads, orders }): Promise<SalesFigures> => {
        const byStage = await leads.aggregate({
            groupBy: ["stage"],
            measures: { count: { kind: "count" } },
            limit: STAGES_MAX,
        })
        const totals = await orders.aggregate({
            measures: {
                draftCount: { kind: "count", where: DRAFT },
                draftVnd: { kind: "sum", field: "amountVnd", where: DRAFT },
                closedCount: { kind: "count", where: CONFIRMED },
                closedVnd: { kind: "sum", field: "amountVnd", where: CONFIRMED },
            },
            limit: 1,
        })
        const measures = totals.reduce<Readonly<Record<string, MeasureValue>>>(
            (all, row) => ({ ...all, ...row.measures }),
            {},
        )
        return salesFiguresOf(
            Object.fromEntries(byStage.map((row) => [String(row.groups["stage"]), Number(row.measures["count"])])),
            {
                draftCount: Number(measures["draftCount"]),
                draftVnd: Number(measures["draftVnd"]),
                closedCount: Number(measures["closedCount"]),
                closedVnd: Number(measures["closedVnd"]),
            },
        )
    },
})
