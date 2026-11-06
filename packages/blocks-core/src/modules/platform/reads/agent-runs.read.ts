import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListShape, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { ALL_RUNS, RUN_FIELDS, RUN_FILTERS, runRowOf, statusesOf } from "../agent-runs"
import type { AgentRunRow, RunFilter } from "../agent-runs"
import { PLATFORM_VIEW } from "../constants"
import { agentGraphs, agentRuns, agentRunsList } from "../ports"
import { agentOfInstallation } from "./agent-run-scope"

/** The most runs a page lists when the read names no limit. */
export const RUNS_PAGE = 20

/** The most runs a page lists at all. */
export const RUNS_PAGE_MAX = 50

/** One page of the runs of an installation: the rows and the cursor of the next page. */
interface AgentRunsPage {
    /** The runs, newest first. */
    readonly rows: ReadonlyArray<AgentRunRow>
    /** The cursor of the next page; null on the last. */
    readonly cursor: string | null
}

/** The condition of a page: the runs of the agent, narrowed to the statuses of a filter. */
const whereOf = (agent: string, filter: RunFilter | undefined): FilterExpr => {
    const ofAgent = q.eq("agentId", agent)
    return filter === undefined ? ofAgent : q.and(ofAgent, q.in("status", statusesOf(filter)))
}

/** What the list says about itself, so a host pages it: the rows are the runs, newest first, `RUNS_PAGE` a page, narrowed by the status filter. */
const RUNS_SHAPE: ListShape = {
    filters: { status: { field: "status", op: "eq", of: RUN_FILTERS } },
    sort: {
        recent: [
            ["startedAt", "desc"],
            ["id", "desc"],
        ],
    },
    page: { size: RUNS_PAGE },
    row: { id: "id", title: "trigger", description: "when" },
}

/**
 * `platform.agent-runs`: the runs of the agent an installation runs, newest first, narrowed by the status filter, one cursor page at a
 * time. A row carries the `agent.run` id that `platform.resume-run` takes. An installation the workspace does not have lists nothing.
 */
const runsRead: ReadDefinition = defineRead({
    id: "platform.agent-runs",
    dataKind: "platform-agent-runs",
    shape: "list",
    fields: ["id", "status", "trigger", "when", "duration"],
    paths: { rows: "list" },
    variables: z.object({
        installation: z.string().uuid(),
        status: z.enum([ALL_RUNS, ...RUN_FILTERS]).optional(),
        cursor: z.string().min(1).max(MAX_ID).optional(),
        limit: z.number().int().min(1).max(RUNS_PAGE_MAX).default(RUNS_PAGE),
    }),
    permission: PLATFORM_VIEW,
    ports: { graphs: agentGraphs, runs: agentRuns },
    run: async ({ graphs, runs }, variables, context): Promise<AgentRunsPage> => {
        const agent = await agentOfInstallation(graphs, variables.installation)
        if (agent === null) return { rows: [], cursor: null }
        const filter = variables.status === undefined || variables.status === ALL_RUNS ? undefined : variables.status
        const page = await runs.list({
            select: RUN_FIELDS,
            where: whereOf(agent, filter),
            order: [
                ["startedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: variables.limit, ...(variables.cursor === undefined ? {} : { after: variables.cursor }) },
        })
        const where = { locale: context.locale, timeZone: context.timeZone, now: context.now }
        return { rows: page.rows.map((listed) => runRowOf(listed.row, where)), cursor: page.next }
    },
})

/** The read, declared as a list that a host pages by its cursor. */
export const agentRunsRead: ReadDefinition = {
    ...runsRead,
    listing: { kind: "list", shape: RUNS_SHAPE, defaultSort: "recent", source: agentRunsList },
}
