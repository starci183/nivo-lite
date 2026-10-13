import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { RunCommandStep } from "../../steps/run-command.step"
import { ConnectionCommandsProcessor } from "./connection-commands.processor"

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "connection_commands",
    fencingToken: 7,
    currentStep: null,
    payload: { commandId: "command-1", workspaceId: "workspace-1" },
}

const build = async () => {
    const runCommand = mock<RunCommandStep>()
    const moduleRef = await Test.createTestingModule({
        providers: [ConnectionCommandsProcessor, { provide: RunCommandStep, useValue: runCommand }],
    }).compile()
    return { processor: moduleRef.get(ConnectionCommandsProcessor), runCommand }
}

describe("ConnectionCommandsProcessor", () => {
    it("consumes every job of the connection_commands queue with the app's concurrency", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("connection_commands")
        expect(processor.job).toBeUndefined()
        expect(processor.concurrency).toBeUndefined()
    })

    it("delegates the exact fenced claim to the command step", async () => {
        const { processor, runCommand } = await build()

        await expect(processor.process(claimedJob)).resolves.toBeUndefined()

        expect(runCommand.run.mock.calls).toEqual([[claimedJob]])
        expect(runCommand.run.mock.calls[0]?.[0]).toBe(claimedJob)
    })

    it("propagates a step failure to the job runner", async () => {
        const { processor, runCommand } = await build()
        const cause = new Error("step failed")
        runCommand.run.mockRejectedValue(cause)

        await expect(processor.process(claimedJob)).rejects.toBe(cause)

        expect(runCommand.run.mock.calls).toEqual([[claimedJob]])
    })
})
