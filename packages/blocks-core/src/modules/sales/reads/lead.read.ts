import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { orderSummaryOf } from "../../../rules/sales/lead-orders"
import { ORDERS_OF_LEAD_LIMIT, SALES_VIEW } from "../constants"
import { leadDetailOf } from "../details"
import { salesLeads, salesOrders } from "../ports"
import { ORDER_BRIEF_FIELDS, leadRowOf, orderBriefOf } from "../sales-records"
import type { LeadDetail } from "../sales.types"

const variables: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/** The fields of a lead detail. */
export const LEAD_DETAIL_FIELDS: ReadonlyArray<keyof LeadDetail> = [
    "id",
    "contactName",
    "company",
    "channel",
    "need",
    "stage",
    "phone",
    "email",
    "contextSummary",
    "closedReason",
    "createdAt",
    "updatedAt",
    "orderCount",
    "confirmedVnd",
    "latestOrderNo",
    "latestOrderStatus",
    "latestOrderAmountVnd",
]

/** `sales.lead`: one lead with what its orders add up to; null when the workspace has no such lead. */
export const leadRead: ReadDefinition = defineRead({
    id: "sales.lead",
    dataKind: "sales-lead",
    shape: "record",
    fields: LEAD_DETAIL_FIELDS,
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeads, orders: salesOrders },
    run: async ({ leads, orders }, { id }): Promise<LeadDetail | null> => {
        const record = await leads.get(id)
        const lead = record === null ? null : leadRowOf(record)
        if (lead === null) return null
        const page = await orders.list({
            select: ORDER_BRIEF_FIELDS,
            where: q.eq("leadId", id),
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: ORDERS_OF_LEAD_LIMIT },
        })
        const briefs = page.rows.flatMap((listed) => {
            const brief = orderBriefOf(listed.row)
            return brief === null ? [] : [brief]
        })
        return leadDetailOf(lead, orderSummaryOf(briefs))
    },
})
