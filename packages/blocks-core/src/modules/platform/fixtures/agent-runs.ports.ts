import type {
    AggregateRow,
    EntityAggregate,
    EntityApi,
    EntityQuery,
    PageRow,
    RecordRow,
} from "@nivo-lite/agent-sdk/entity/port"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { agentGraphs, agentRuns } from "../ports"

/** The viewer and the instant of the runs reads in the specs. */
export const RUNS_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: "m1",
    now: new Date("2026-11-05T08:10:00.000Z"),
    timeZone: "UTC",
    locale: "en",
}

/** The installation of the specs and the agent it runs. */
export const INSTALLATION_ID = "0b6f7c1e-3a53-4a3f-9d52-2d7e8b5f1c11"
export const AGENT_ID = "6f1c3a52-0f0b-4b57-9a2c-1c2f6d7e8a90"

/** A record row with the fields given. */
export const recordRow = (id: string, data: Record<string, unknown>): RecordRow => ({
    id,
    workspaceId: "w1",
    version: "1",
    createdAt: "2026-11-05T08:00:00.000Z",
    updatedAt: "2026-11-05T08:00:00.000Z",
    data,
})

const pageRow = (row: RecordRow): PageRow => ({ row, joined: {}, position: [], included: {} })

const unused = (): Promise<never> => Promise.reject(new Error("unused"))

/** What one fake entity answers, and what it was asked. */
export interface FakeEntity {
    readonly api: EntityApi
    readonly queries: Array<EntityQuery>
    readonly aggregates: Array<EntityAggregate>
    readonly gets: Array<string>
}

/** An entity that lists the rows given (with `next` as the cursor of the page), answers the groups given and gets the row of an id. */
export const fakeEntity = (
    rows: ReadonlyArray<RecordRow>,
    options: { readonly next?: string | null; readonly groups?: ReadonlyArray<AggregateRow> } = {},
): FakeEntity => {
    const queries: Array<EntityQuery> = []
    const aggregates: Array<EntityAggregate> = []
    const gets: Array<string> = []
    const api: EntityApi = {
        get: (id) => {
            gets.push(id)
            return Promise.resolve(rows.find((row) => row.id === id) ?? null)
        },
        list: (query) => {
            queries.push(query)
            return Promise.resolve({ rows: rows.map(pageRow), next: options.next ?? null })
        },
        aggregate: (aggregate) => {
            aggregates.push(aggregate)
            return Promise.resolve(options.groups ?? [])
        },
        insert: unused,
        update: unused,
        upsert: unused,
        ensure: unused,
        delete: unused,
        link: unused,
        unlink: unused,
    }
    return { api, queries, aggregates, gets }
}

/** The graph that holds the installation of the specs for the agent of the specs. */
export const GRAPH_ROW: RecordRow = recordRow("g1", { agentId: AGENT_ID, installationId: INSTALLATION_ID })

/** The provider of the three entity ports the runs reads take. */
export const runsProvider = (entities: {
    readonly graphs: EntityApi
    readonly runs: EntityApi
    readonly steps: EntityApi
}): PortProvider => ({
    implementationOf: (port) => {
        if (port.id === agentGraphs.id) return entities.graphs
        if (port.id === agentRuns.id) return entities.runs
        return entities.steps
    },
})
