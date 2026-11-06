import type { ListPage, ListQuery, ListShape, ListSource } from "../block/list.types"
import { definePort } from "../port/port"
import type { PortDefinition, PortProvider, RunContext } from "../port/port.types"
import type { ReadDefinition } from "../block/block.types"
import { countsRead, listRead } from "./declaration-list"
import type { ListReadDefinition } from "./declaration-list.types"

/** A row of the list the declaration specs run on. */
export interface Lead {
    /** The id of the lead. */
    readonly id: string
    /** The name of the lead. */
    readonly name: string
}

/** The port the leads list runs on. */
export const LEADS_PORT: PortDefinition<ListSource<Lead>> = definePort<ListSource<Lead>>("sales.leads-list")

/** A list with search, an enumerated filter, a filter of named cases and two sorts. */
export const LEADS_SHAPE: ListShape = {
    search: { fields: ["name", "phone"] },
    filters: {
        stage: { field: "stage", op: "eq", of: ["new", "won"] },
        stock: {
            cases: {
                low: { field: "quantity", op: "lte", ref: "reorder" },
                out: { field: "quantity", op: "eq", value: 0 },
            },
        },
    },
    sort: {
        recent: [["updatedAt", "desc"]],
        name: [["name", "asc"]],
    },
    page: { size: 30 },
    row: { id: "id", title: "name", badge: "stage" },
}

/** The list read of the leads. */
export const LEADS: ListReadDefinition = listRead({
    id: "sales.leads",
    dataKind: "lead",
    permission: "sales.view",
    fields: ["id", "name"],
    list: LEADS_SHAPE,
    source: LEADS_PORT,
})

/** The counts read of the leads by stage. */
export const LEAD_COUNTS: ReadDefinition = countsRead({ id: "sales.lead-counts", of: LEADS, by: "stage" })

/** A request scope for a run. */
export const CONTEXT: RunContext = { workspaceId: "w1", memberId: "m1", now: new Date("2026-11-05T00:00:00Z"), timeZone: "Asia/Ho_Chi_Minh" }

/** What a recording source saw. */
export interface SourceCalls {
    /** The queries the source was asked a page for. */
    readonly pages: Array<ListQuery>
    /** The counts the source was asked for. */
    readonly counts: Array<{ readonly by: string; readonly query: ListQuery }>
}

/** A provider whose only port is the leads source: a page of one lead and counts of 2 new and 3 won. */
export const leadsProvider = (calls: SourceCalls): PortProvider => ({
    implementationOf: () => {
        const source: ListSource<Lead> = {
            page: (_shape, query): Promise<ListPage<Lead>> => {
                calls.pages.push(query)
                return Promise.resolve({ rows: [{ id: "l1", name: "An" }], cursor: "next" })
            },
            counts: (_shape, by, query) => {
                calls.counts.push({ by, query })
                return Promise.resolve({ new: 2, won: 3 })
            },
        }
        return source
    },
})
