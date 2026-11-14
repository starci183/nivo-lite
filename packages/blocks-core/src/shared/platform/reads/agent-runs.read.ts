import { defineRead, type ListShape, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { ALL_RUNS, RUN_FILTERS, runRowOf, statusesOf, type RunFilter } from "../agent-runs"
import { deskLocaleOf, deskRunRowOf, type DeskRunRow } from "../agent-desk"
import { PLATFORM_VIEW } from "../constants"
import { agentDeskPort, agentRunsList, coreReadsPort } from "../ports"

/** The most runs a page lists when the read names no limit. */
export const RUNS_PAGE = 20

/** The most runs a page lists at all. */
export const RUNS_PAGE_MAX = 50

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
    row: { id: "id", title: "subject", description: "facts" },
}

/** One page of the runs with the desk's facts of each. */
export interface DeskRunsPage {
    /** The runs, newest first. */
    readonly rows: ReadonlyArray<DeskRunRow>
    /** The cursor of the next page; null on the last. */
    readonly cursor: string | null
}

/**
 * `platform.agent-runs`: the runs of the agent an installation runs, newest first, narrowed by the status filter, one cursor page at a
 * time. A row carries the run id that `platform.resume-run` takes, and the desk's facts of the run (`platform.agent-desk`
 * `runFacts`, merged by run id: the question or task, who asked, the records read and changed, how it ended); a run the desk does not
 * answer for keeps nulls. An installation the workspace does not have lists nothing.
 */
const runsRead: ReadDefinition = defineRead({
    id: "platform.agent-runs",
    dataKind: "platform-agent-runs",
    shape: "list",
    fields: [
        "id",
        "status",
        "trigger",
        "when",
        "duration",
        "subject",
        "ask",
        "askedBy",
        "readCount",
        "changedCount",
        "uncounted",
        "outcome",
        "facts",
    ],
    paths: { rows: "list" },
    variables: z.object({
        installation: z.uuid(),
        status: z.enum([ALL_RUNS, ...RUN_FILTERS]).optional(),
        cursor: z.string().min(1).max(MAX_ID).optional(),
        limit: z.number().int().min(1).max(RUNS_PAGE_MAX).default(RUNS_PAGE),
    }),
    permission: PLATFORM_VIEW,
    ports: { core: coreReadsPort, desk: agentDeskPort },
    run: async ({ core, desk }, variables, context): Promise<DeskRunsPage> => {
        const agent = await core.agentOf(variables.installation)
        if (agent === null) return { rows: [], cursor: null }
        const filter: RunFilter | undefined =
            variables.status === undefined || variables.status === ALL_RUNS ? undefined : variables.status
        const page = await core.runs.list({
            agent,
            ...(filter === undefined ? {} : { statuses: statusesOf(filter) }),
            order: "started",
            size: variables.limit,
            ...(variables.cursor === undefined ? {} : { after: variables.cursor }),
        })
        const where = { locale: context.locale, timeZone: context.timeZone, now: context.now }
        const rows = page.rows.map((run) => runRowOf(run, where))
        const facts = rows.length === 0 ? [] : await desk.runFacts(variables.installation, rows.map((row) => row.id))
        const byRun = new Map(facts.map((fact) => [fact.runId, fact]))
        const locale = deskLocaleOf(context.locale)
        return { rows: rows.map((row) => deskRunRowOf(row, byRun.get(row.id), locale)), cursor: page.next }
    },
})

/** The read, declared as a list that a host pages by its cursor. */
export const agentRunsRead: ReadDefinition = {
    ...runsRead,
    listing: { kind: "list", shape: RUNS_SHAPE, defaultSort: "recent", source: agentRunsList },
}
