import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { RUN_STEPS_MAX } from "../../../rows/graph-view"
import type { RunView } from "../../../rows/run-timeline-view"
import { STEP_FIELDS, runViewOf } from "../agent-runs"
import { PLATFORM_VIEW } from "../constants"
import { agentGraphs, agentRunSteps, agentRuns } from "../ports"
import { agentOfInstallation } from "./agent-run-scope"

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
    variables: z.object({ installation: z.string().uuid(), id: z.string().min(1).max(MAX_ID) }),
    permission: PLATFORM_VIEW,
    ports: { graphs: agentGraphs, runs: agentRuns, steps: agentRunSteps },
    run: async ({ graphs, runs, steps }, { installation, id }): Promise<RunView | null> => {
        const agent = await agentOfInstallation(graphs, installation)
        const run = agent === null ? null : await runs.get(id)
        if (run === null || run.data["agentId"] !== agent) return null
        const listed = await steps.list({
            select: STEP_FIELDS,
            where: q.eq("runId", id),
            order: [
                ["ordinal", "asc"],
                ["id", "asc"],
            ],
            page: { size: RUN_STEPS_MAX },
        })
        return runViewOf(
            run,
            listed.rows.map((step) => step.row),
        )
    },
})
