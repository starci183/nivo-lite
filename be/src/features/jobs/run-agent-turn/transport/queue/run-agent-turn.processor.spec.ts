import { mock } from "@starci/jest-preset"
import type { AgentRunsLimitService } from "@modules/domain/agent-runs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { DrainStep } from "../../steps/drain.step"
import { RunAgentTurnProcessor } from "./run-agent-turn.processor"

/** The processor over a drain double and the capacity the limit service gives (100, and all of it for one workspace, when unset). */
const build = (concurrency = 100, workspaceConcurrency = concurrency) => {
    const drain = mock<DrainStep>()
    drain.run.mockResolvedValue(undefined)
    const limit = mock<AgentRunsLimitService>({ concurrency, workspaceConcurrency })
    return { processor: new RunAgentTurnProcessor(drain, limit), drain }
}

describe("RunAgentTurnProcessor capacity", () => {
    it("drives as many runs at once as the app setting says (100 by default), and lets one workspace's drains start up to all of them", () => {
        const { processor } = build()

        expect([processor.concurrency, processor.workspaceHeadroom]).toEqual([100, 100])
    })

    it("follows the settings: a shared deployment lowers one workspace's headroom", () => {
        const { processor } = build(40, 10)

        expect([processor.concurrency, processor.workspaceHeadroom]).toEqual([40, 10])
    })

    it("holds a slot only while a drain runs: a run that parks ends its turn, the drain resolves and the runner settles the job", async () => {
        const { processor, drain } = build()
        const job = mock<ClaimedJob>({ jobId: "j-1", fencingToken: 1, payload: { agentId: "a-1", scopeKey: "agent" } })

        await expect(processor.process(job)).resolves.toBeUndefined()

        expect(drain.run).toHaveBeenCalledTimes(1)
        expect(drain.run).toHaveBeenCalledWith(job)
    })
})
