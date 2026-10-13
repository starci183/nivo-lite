import assert from "node:assert/strict"
import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { InventoryCommandService } from "@modules/domain/inventory"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { RunCommandStep } from "./run-command.step"

const claimed: ClaimedJob = {
    jobId: "job-1",
    kind: "inventory_command",
    fencingToken: 3,
    currentStep: null,
    payload: { commandId: "command-1", workspaceId: "ws-1" },
}

interface ClaimsDependency {
    readonly index: 0
    readonly param: unique symbol
}

const isClaimsDependency = (value: unknown): value is ClaimsDependency =>
    typeof value === "object" &&
    value !== null &&
    "index" in value &&
    value.index === 0 &&
    "param" in value &&
    typeof value.param === "symbol"

// The public jobs entry exports the injector but omits its token, so use the subject's existing Nest injection metadata.
const jobClaimsDependency = (): ClaimsDependency => {
    const dependencies: unknown = Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, RunCommandStep)
    assert(Array.isArray(dependencies), "RunCommandStep must declare its injected claim token")
    const dependency = dependencies.find(isClaimsDependency)
    assert(dependency !== undefined, "RunCommandStep must declare its injected claim token")
    return dependency
}

const build = async () => {
    const claims = mock<JobClaims>()
    const commands = mock<InventoryCommandService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunCommandStep,
            { provide: jobClaimsDependency().param, useValue: claims },
            { provide: InventoryCommandService, useValue: commands },
        ],
    }).compile()
    return { step: moduleRef.get(RunCommandStep), claims, commands }
}

describe("RunCommandStep", () => {
    it("records the command step with the claim token before running its payload", async () => {
        const { step, claims, commands } = await build()
        claims.advance.mockImplementation(() => {
            expect(commands.runJob).not.toHaveBeenCalled()
            return Promise.resolve()
        })

        await expect(step.run(claimed)).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 3, step: "run-command" }]])
        expect(commands.runJob.mock.calls).toEqual([[{ commandId: "command-1", workspaceId: "ws-1" }]])
    })

    it("does not run the command when the claim token is stale", async () => {
        const { step, claims, commands } = await build()
        const error = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(error)

        await expect(step.run(claimed)).rejects.toBe(error)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 3, step: "run-command" }]])
        expect(commands.runJob).not.toHaveBeenCalled()
    })

    it("passes a command failure to the job runner after recording the step", async () => {
        const { step, claims, commands } = await build()
        const error = new Error("command could not be loaded")
        commands.runJob.mockRejectedValue(error)

        await expect(step.run(claimed)).rejects.toBe(error)

        expect(claims.advance.mock.calls).toEqual([[{ jobId: "job-1", expectedFencingToken: 3, step: "run-command" }]])
        expect(commands.runJob.mock.calls).toEqual([[{ commandId: "command-1", workspaceId: "ws-1" }]])
    })
})
