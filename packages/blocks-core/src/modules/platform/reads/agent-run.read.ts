import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import type { EntityApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { QUERY_BOUNDS, q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { RUN_STEPS_MAX } from "../../../rows/graph-view"
import type { RunView } from "../../../rows/run-timeline-view"
import { STEP_FIELDS, runViewOf } from "../agent-runs"
import { PLATFORM_VIEW } from "../constants"
import { agentGraphs, agentRunSteps, agentRuns } from "../ports"
import { agentOfInstallation } from "./agent-run-scope"

/** The steps one statement reads: the engine refuses a page over its bound, so a long run is read in pages of at most this. */
export const STEPS_PAGE: number = Math.min(RUN_STEPS_MAX, QUERY_BOUNDS.pageSize)

/** The steps of a run in order, read page by page from the cursor `after` up to the cap the timeline draws. */
const stepsOf = async (
    steps: EntityApi,
    runId: string,
    found: ReadonlyArray<RecordRow> = [],
    after?: string,
): Promise<ReadonlyArray<RecordRow>> => {
    const page = await steps.list({
        select: STEP_FIELDS,
        where: q.eq("runId", runId),
        order: [
            ["ordinal", "asc"],
            ["id", "asc"],
        ],
        page: { size: Math.min(STEPS_PAGE, RUN_STEPS_MAX - found.length), ...(after === undefined ? {} : { after }) },
    })
    const all = [...found, ...page.rows.map((listed) => listed.row)]
    return page.next === null || all.length >= RUN_STEPS_MAX ? all : stepsOf(steps, runId, all, page.next)
}

/**
 * `platform.agent-run`: one run of the agent an installation runs, with its steps in order, in the shape the run timeline draws. The
 * id is the `agent.run` id; a run of another agent, or one that is gone, is null. The step that parked a parked run is told as parked,
 * with the reason the engine parked it.
 */
export const agentRunRead: ReadDefinition = defineRead({
    id: "platform.agent-run",
    dataKind: "platform-agent-run",
    shape: "record",
    fields: ["id", "status", "steps"],
    paths: { steps: "list" },
    variables: z.object({ installation: z.uuid(), id: z.string().min(1).max(MAX_ID) }),
    permission: PLATFORM_VIEW,
    ports: { graphs: agentGraphs, runs: agentRuns, steps: agentRunSteps },
    run: async ({ graphs, runs, steps }, { installation, id }): Promise<RunView | null> => {
        const agent = await agentOfInstallation(graphs, installation)
        const run = agent === null ? null : await runs.get(id)
        if (run === null) return null
        if (run.data["agentId"] !== agent) return null
        return runViewOf(run, await stepsOf(steps, id))
    },
})
