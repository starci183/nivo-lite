import { countsRead, listRead } from "@nivo-lite/agent-sdk/module"
import type { ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import type { ListShape, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { LEAD_STAGES } from "../../../rules/sales/stage"
import { SALES_VIEW } from "../constants"
import { salesLeadsList } from "../ports"
import type { LeadRow } from "../sales.types"

/** What the leads list accepts: a search over the customer's words, the stage as a filter, two sorts. */
export const LEADS_LIST: ListShape = {
    search: { fields: ["contactName", "company", "phone", "email", "need"] },
    filters: { stage: { field: "stage", op: "eq", of: LEAD_STAGES } },
    sort: { recent: [["updatedAt", "desc"]], name: [["contactName", "asc"]] },
    page: { size: 30 },
    row: { id: "id", title: "contactName", description: "need", badge: "stage" },
}

/** The fields of a lead row the list returns. */
export const LEAD_ROW_FIELDS: ReadonlyArray<keyof LeadRow> = [
    "id",
    "contactName",
    "company",
    "channel",
    "need",
    "stage",
    "phone",
    "email",
    "owner",
    "nextStep",
    "nextDueAt",
    "quoteVnd",
    "orderVnd",
    "note",
    "updatedAt",
]

/** `sales.leads`: the leads of the workspace, searched, narrowed by stage and sorted. */
export const leadsRead: ListReadDefinition = listRead({
    id: "sales.leads",
    dataKind: "sales-lead",
    permission: SALES_VIEW,
    fields: LEAD_ROW_FIELDS,
    list: LEADS_LIST,
    source: salesLeadsList,
})

/** `sales.lead-counts`: how many leads each stage holds, under the same search. */
export const leadCountsRead: ReadDefinition = countsRead({ id: "sales.lead-counts", of: leadsRead, by: "stage" })
