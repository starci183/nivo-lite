import { strict as assert } from "node:assert"
import { Test } from "@nestjs/testing"
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants"
import { mock } from "@starci/jest-preset"
import { ConnectionCommandsService } from "@modules/domain/connection-commands"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RunCommandStep } from "./run-command.step"

// The jobs public entry exports the decorator, so use the step's actual injection token.
const injectionTokens: ReadonlyArray<{ readonly index: number; readonly param: typeof JOB_CLAIMS }> =
    Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, RunCommandStep)
const claimsInjection = injectionTokens.find(({ index }) => index === 1)
assert.ok(claimsInjection, "RunCommandStep must declare its job claims injection token")
const JOB_CLAIMS: unique symbol = claimsInjection.param

const claimedJob: ClaimedJob = {
    jobId: "job-1",
    kind: "connection_commands",
    fencingToken: 7,
    currentStep: null,
    payload: { commandId: "command-1", workspaceId: "workspace-1" },
}

const build = async () => {
    const commands = mock<ConnectionCommandsService>()
    const claims = mock<JobClaims>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunCommandStep,
            { provide: ConnectionCommandsService, useValue: commands },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { step: moduleRef.get(RunCommandStep), commands, claims }
}

describe("RunCommandStep", () => {
    it("waits for the guarded advance with the claim's fencing token before running the command", async () => {
        const { step, commands, claims } = await build()
        let finishAdvance!: () => void
        const advanced = new Promise<void>((resolve) => {
            finishAdvance = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(claimedJob)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "run" }]])
        expect(commands.run).not.toHaveBeenCalled()

        finishAdvance()
        await expect(running).resolves.toBeUndefined()

        expect(commands.run.mock.calls).toEqual([["command-1"]])
        expect(claims.advance.mock.invocationCallOrder[0]).toBeLessThan(
            Number(commands.run.mock.invocationCallOrder[0]),
        )
    })

    it.each([
        {},
        { workspaceId: "workspace-1" },
        { commandId: 1, workspaceId: "workspace-1" },
        { commandId: "command-1" },
        { commandId: "command-1", workspaceId: false },
    ])("advances but runs no command for a malformed payload %p", async (payload) => {
        const { step, commands, claims } = await build()

        await expect(step.run({ ...claimedJob, payload })).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "run" }]])
        expect(commands.run).not.toHaveBeenCalled()
    })

    it("stops before the command when the guarded advance fences the worker out", async () => {
        const { step, commands, claims } = await build()
        const cause = new Error("worker fenced out")
        claims.advance.mockRejectedValue(cause)

        await expect(step.run(claimedJob)).rejects.toBe(cause)

        expect(commands.run).not.toHaveBeenCalled()
    })

    it("propagates a command failure after the guarded advance", async () => {
        const { step, commands, claims } = await build()
        const cause = new Error("command failed")
        commands.run.mockRejectedValue(cause)

        await expect(step.run(claimedJob)).rejects.toBe(cause)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 7, step: "run" }]])
        expect(commands.run.mock.calls).toEqual([["command-1"]])
    })
})
