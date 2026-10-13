import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { ClaimedJob, JobProcessorRegistry } from "@modules/platform/jobs"
import { RunZaloWizardQueueModule } from "../.."
import { WizardStep } from "../../steps/wizard.step"
import { RunZaloWizardProcessor } from "./run-zalo-wizard.processor"

const job: ClaimedJob = {
    jobId: "wizard-job-1",
    kind: "zalo_wizard",
    fencingToken: 7,
    currentStep: null,
    payload: { workspaceId: "workspace-1", connectionId: "connection-1", command: "begin", ticket: "ticket-1" },
}

const build = async () => {
    const wizard = mock<WizardStep>()
    wizard.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [RunZaloWizardProcessor, { provide: WizardStep, useValue: wizard }],
    }).compile()
    return { processor: moduleRef.get(RunZaloWizardProcessor), wizard }
}

describe("RunZaloWizardProcessor", () => {
    it("consumes the Zalo wizard queue", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("zalo_wizard")
    })

    it("passes the fenced claim to the wizard step exactly once and awaits its completion", async () => {
        const { processor, wizard } = await build()
        let finishStep: () => void = () => undefined
        wizard.run.mockReturnValue(
            new Promise<void>((resolve) => {
                finishStep = resolve
            }),
        )
        const finished = jest.fn()

        const processing = processor.process(job).then(finished)
        await Promise.resolve()

        expect(wizard.run.mock.calls).toEqual([
            [
                {
                    jobId: "wizard-job-1",
                    kind: "zalo_wizard",
                    fencingToken: 7,
                    currentStep: null,
                    payload: {
                        workspaceId: "workspace-1",
                        connectionId: "connection-1",
                        command: "begin",
                        ticket: "ticket-1",
                    },
                },
            ],
        ])
        expect(wizard.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).not.toHaveBeenCalled()

        finishStep()

        await expect(processing).resolves.toBeUndefined()
        expect(finished.mock.calls).toEqual([[undefined]])
        expect(wizard.run).toHaveBeenCalledTimes(1)
    })

    it("propagates the wizard step failure unchanged", async () => {
        const { processor, wizard } = await build()
        const failure = { code: "JOBS_FENCED_OUT" }
        wizard.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)

        expect(wizard.run).toHaveBeenCalledTimes(1)
        expect(wizard.run.mock.calls[0]?.[0]).toBe(job)
    })

    it("registers its processor with the job runner when the queue module initializes", async () => {
        const registry = mock<JobProcessorRegistry>()
        const wizard = mock<WizardStep>()
        const moduleRef = await Test.createTestingModule({ imports: [RunZaloWizardQueueModule] })
            .overrideProvider(WizardStep)
            .useValue(wizard)
            .useMocker((token) =>
                typeof token === "symbol" && token.description === "platform.jobs.processor-registry"
                    ? registry
                    : undefined,
            )
            .compile()

        await moduleRef.init()

        expect(registry.add).toHaveBeenCalledTimes(1)
        expect(registry.add.mock.calls[0]?.[0]).toBe(moduleRef.get(RunZaloWizardProcessor))
        await moduleRef.close()
    })
})
