import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { RunCommandStep } from "../../steps/run-command.step"
import { InventoryCommandProcessor } from "./inventory-command.processor"

const claimed: ClaimedJob = {
    jobId: "job-1",
    kind: "inventory_command",
    fencingToken: 3,
    currentStep: null,
    payload: { commandId: "command-1", workspaceId: "ws-1" },
}

const build = async () => {
    const runCommand = mock<RunCommandStep>()
    const moduleRef = await Test.createTestingModule({
        providers: [InventoryCommandProcessor, { provide: RunCommandStep, useValue: runCommand }],
    }).compile()
    return { processor: moduleRef.get(InventoryCommandProcessor), runCommand }
}

describe("InventoryCommandProcessor", () => {
    it("consumes the inventory command queue and passes the fenced claim to the command step", async () => {
        const { processor, runCommand } = await build()

        await expect(processor.process(claimed)).resolves.toBeUndefined()

        expect(processor.queue).toBe("inventory_command")
        expect(runCommand.run.mock.calls).toEqual([[claimed]])
    })

    it("passes a step failure to the job runner", async () => {
        const { processor, runCommand } = await build()
        const error = new Error("claim token is stale")
        runCommand.run.mockRejectedValue(error)

        await expect(processor.process(claimed)).rejects.toBe(error)

        expect(runCommand.run.mock.calls).toEqual([[claimed]])
    })
})
