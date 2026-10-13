import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentSyncService } from "@modules/domain/openclaw-agent-sync"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { SyncAgentsStep } from "./sync-agents.step"

const JOB: ClaimedJob = {
    jobId: "job-1",
    kind: "agents.sync",
    fencingToken: 3,
    currentStep: null,
    payload: { workspaceId: "w1", installationId: "i1", force: false },
}

const build = async () => {
    const claims = mock<JobClaims>({ advance: jest.fn(() => Promise.resolve()) })
    const sync = mock<AgentSyncService>({ process: jest.fn(() => Promise.resolve(1)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            SyncAgentsStep,
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: AgentSyncService, useValue: sync },
        ],
    }).compile()
    return { step: moduleRef.get(SyncAgentsStep), claims, sync }
}

describe("SyncAgentsStep", () => {
    it("records the step with its token first and then does the work", async () => {
        const { step, claims, sync } = await build()
        const order: Array<string> = []
        claims.advance.mockImplementation(() => {
            order.push("advance")
            return Promise.resolve()
        })
        sync.process.mockImplementation(() => {
            order.push("work")
            return Promise.resolve(1)
        })

        await step.run(JOB)

        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "sync" })
        expect(sync.process).toHaveBeenCalledWith(JOB.payload)
        expect(order).toEqual(["advance", "work"])
    })

    it("does no work when the token is stale", async () => {
        const { step, claims, sync } = await build()
        const fenced = new Error("fenced out")
        claims.advance.mockRejectedValue(fenced)

        await expect(step.run(JOB)).rejects.toBe(fenced)
        expect(sync.process).not.toHaveBeenCalled()
    })
})
