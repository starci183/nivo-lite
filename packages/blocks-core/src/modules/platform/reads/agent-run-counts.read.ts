import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { countsOf } from "../agent-runs"
import type { AgentRunCounts } from "../agent-runs"
import { PLATFORM_VIEW } from "../constants"
import { agentGraphs, agentRuns } from "../ports"
import { agentOfInstallation } from "./agent-run-scope"

/** The most groups the count by status asks for: the engine has eight statuses. */
const STATUS_GROUPS = 16

/** What an installation with no runs counts. */
const NO_RUNS: AgentRunCounts = { counts: { running: 0, parked: 0, done: 0, failed: 0 }, total: 0 }

/** `platform.agent-run-counts`: how many runs the agent of an installation has under each filter of the runs list, and in all. */
export const agentRunCountsRead: ReadDefinition = defineRead({
    id: "platform.agent-run-counts",
    dataKind: "counts",
    shape: "record",
    fields: ["counts", "total"],
    paths: { counts: "record" },
    variables: z.object({ installation: z.string().uuid() }),
    permission: PLATFORM_VIEW,
    ports: { graphs: agentGraphs, runs: agentRuns },
    run: async ({ graphs, runs }, { installation }): Promise<AgentRunCounts> => {
        const agent = await agentOfInstallation(graphs, installation)
        if (agent === null) return NO_RUNS
        return countsOf(
            await runs.aggregate({
                where: q.eq("agentId", agent),
                groupBy: ["status"],
                measures: { count: { kind: "count" } },
                limit: STATUS_GROUPS,
            }),
        )
    },
})
