import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { orderSummaryOf } from "../../../rules/sales/lead-orders"
import { ORDERS_OF_LEAD_LIMIT, SALES_VIEW } from "../constants"
import { leadDetailOf } from "../details"
import { salesLeadStore, salesOrderStore } from "../ports"
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
    ports: { leads: salesLeadStore, orders: salesOrderStore },
    run: async ({ leads, orders }, { id }): Promise<LeadDetail | null> => {
        const lead = await leads.get(id)
        if (lead === null) return null
        return leadDetailOf(lead, orderSummaryOf(await orders.ofLead(id, ORDERS_OF_LEAD_LIMIT)))
    },
})
