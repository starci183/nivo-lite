import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { JobContext, JobDefinition } from "@nivo-lite/agent-sdk/mutation"
import { runDeclaredJob } from "./declared-job.policy"

const DECLARED_JOB: unique symbol = Symbol("entity-engine.declared-job")

interface DeclaredJobPolicy {
    readonly runDeclaredJob: typeof runDeclaredJob
}

const build = async (): Promise<DeclaredJobPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: DECLARED_JOB, useFactory: (): DeclaredJobPolicy => ({ runDeclaredJob }) }],
    }).compile()
    return moduleRef.get<DeclaredJobPolicy>(DECLARED_JOB)
}

const CONTEXT: JobContext = { workspaceId: "ws-1", attempt: 1, effectKey: (step) => `job-1:${step}` }

describe("runDeclaredJob", () => {
    it("runs the job with its ports, its input and its context", async () => {
        const policy = await build()
        const job = mock<JobDefinition>()
        job.run.mockResolvedValue(undefined)
        const ports = { orders: { handle: "orders" } }

        await expect(
            policy.runDeclaredJob(job, ports, { orderId: "00000000-0000-4000-8000-000000000001" }, CONTEXT),
        ).resolves.toBeUndefined()

        expect(job.run).toHaveBeenCalledWith(ports, { orderId: "00000000-0000-4000-8000-000000000001" }, CONTEXT)
    })

    it("lets a failure of the job reach the caller", async () => {
        const policy = await build()
        const job = mock<JobDefinition>()
        job.run.mockRejectedValue(new Error("boom"))

        await expect(policy.runDeclaredJob(job, {}, {}, CONTEXT)).rejects.toThrow("boom")
    })
})
