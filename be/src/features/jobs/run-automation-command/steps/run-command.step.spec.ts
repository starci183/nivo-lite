import { mock } from "@starci/jest-preset"
import type { AutomationCommandsService } from "@modules/domain/automation-commands"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RunCommandStep } from "./run-command.step"

const JOB: ClaimedJob = {
    jobId: "job-command-1",
    kind: "automation.command",
    fencingToken: 11,
    currentStep: null,
    payload: { commandId: "00000000-0000-4000-8000-000000000001" },
}

const build = () => {
    const commands = mock<AutomationCommandsService>()
    const claims = mock<JobClaims>()
    const step = new RunCommandStep(commands, claims)
    return { step, commands, claims }
}

describe("RunCommandStep", () => {
    it("awaits the guarded advance before executing the command payload", async () => {
        const { step, commands, claims } = build()
        claims.advance.mockImplementation(async () => {
            await Promise.resolve()
            expect(commands.execute).not.toHaveBeenCalled()
        })
        commands.execute.mockResolvedValue()

        await expect(step.run(JOB)).resolves.toBeUndefined()

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-command-1",
            expectedFencingToken: 11,
            step: "command",
        })
        expect(commands.execute).toHaveBeenCalledTimes(1)
        expect(commands.execute).toHaveBeenCalledWith(JOB.payload)
    })

    it("does not execute the command when the guarded advance rejects a stale claim", async () => {
        const { step, commands, claims } = build()
        const failure = new Error("stale fencing token")
        claims.advance.mockRejectedValue(failure)

        await expect(step.run(JOB)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(commands.execute).not.toHaveBeenCalled()
    })

    it("propagates a command failure after recording the step", async () => {
        const { step, commands, claims } = build()
        const failure = new Error("command unavailable")
        claims.advance.mockResolvedValue()
        commands.execute.mockRejectedValue(failure)

        await expect(step.run(JOB)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(commands.execute).toHaveBeenCalledTimes(1)
        expect(commands.execute).toHaveBeenCalledWith(JOB.payload)
    })
})
