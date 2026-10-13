import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ZaloWizardService } from "@modules/domain/channels"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { WizardStep } from "./wizard.step"

const job: ClaimedJob = {
    jobId: "wizard-job-1",
    kind: "zalo_wizard",
    fencingToken: 11,
    currentStep: null,
    payload: { workspaceId: "workspace-1", connectionId: "connection-1", command: "app", ticket: "ticket-1" },
}

const build = async () => {
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const service = mock<ZaloWizardService>()
    service.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [WizardStep, { provide: ZaloWizardService, useValue: service }],
    })
        .useMocker((token) =>
            typeof token === "symbol" && token.description === "platform.jobs.claims" ? claims : undefined,
        )
        .compile()
    return { step: moduleRef.get(WizardStep), claims, service }
}

describe("WizardStep", () => {
    it("records the wizard step under the held fencing token before it delegates the payload", async () => {
        const { step, claims, service } = await build()
        let release: () => void = () => undefined
        claims.advance.mockReturnValue(
            new Promise<void>((resolve) => {
                release = resolve
            }),
        )

        const running = step.run(job)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "wizard-job-1", expectedFencingToken: 11, step: "wizard" }],
        ])
        expect(service.run).not.toHaveBeenCalled()
        release()

        await expect(running).resolves.toBeUndefined()
        expect(service.run.mock.calls).toEqual([
            [{ workspaceId: "workspace-1", connectionId: "connection-1", command: "app", ticket: "ticket-1" }],
        ])
    })

    it("stops on a stale fencing token before running the wizard", async () => {
        const { step, claims, service } = await build()
        const refusal = { code: "JOBS_FENCED_OUT" }
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(job)).rejects.toBe(refusal)

        expect(service.run).not.toHaveBeenCalled()
    })

    it("propagates a failure of the wizard command", async () => {
        const { step, service } = await build()
        const failure = { code: "unavailable" }
        service.run.mockRejectedValue(failure)

        await expect(step.run(job)).rejects.toBe(failure)
    })
})
