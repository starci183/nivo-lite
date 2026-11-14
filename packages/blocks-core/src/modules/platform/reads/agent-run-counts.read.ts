import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { countsOf, type AgentRunCounts } from "../agent-runs"
import { PLATFORM_VIEW } from "../constants"
import { coreReadsPort } from "../ports"

/** What an installation with no runs counts. */
const NO_RUNS: AgentRunCounts = { counts: { running: 0, parked: 0, done: 0, failed: 0 }, total: 0 }

/** `platform.agent-run-counts`: how many runs the agent of an installation has under each filter of the runs list, and in all. */
export const agentRunCountsRead: ReadDefinition = defineRead({
    id: "platform.agent-run-counts",
    dataKind: "counts",
    shape: "record",
    fields: ["counts", "total"],
    paths: { counts: "record" },
    variables: z.object({ installation: z.uuid() }),
    permission: PLATFORM_VIEW,
    ports: { core: coreReadsPort },
    run: async ({ core }, { installation }): Promise<AgentRunCounts> => {
        const agent = await core.agentOf(installation)
        if (agent === null) return NO_RUNS
        return countsOf(await core.runs.count(agent))
    },
})
