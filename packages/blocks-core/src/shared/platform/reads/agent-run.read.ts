import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { RUN_STEPS_MAX } from "../../rows/graph-view"
import type { RunView } from "../../rows/run-timeline-view"
import { runViewOf } from "../agent-runs"
import { PLATFORM_VIEW } from "../constants"
import { coreReadsPort } from "../ports"

/**
 * `platform.agent-run`: one run of the agent an installation runs, with its steps in order, in the shape the run timeline draws. The
 * id is the run id; a run of another agent, or one that is gone, is null. The step that parked a parked run is told as parked,
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
    ports: { core: coreReadsPort },
    run: async ({ core }, { installation, id }): Promise<RunView | null> => {
        const agent = await core.agentOf(installation)
        const run = agent === null ? null : await core.runs.get(id)
        if (run === null) return null
        if (run.agentId !== agent) return null
        return runViewOf(run, await core.runs.steps(id, RUN_STEPS_MAX))
    },
})
