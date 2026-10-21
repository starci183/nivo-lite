import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { WorkspaceCleanupService } from "@modules/domain/workspace-cleanup"
import { RunCleanupWorkspacesCli } from "./run.cli"

const build = async () => {
    const cleanup = mock<WorkspaceCleanupService>()
    const moduleRef = await Test.createTestingModule({
        providers: [RunCleanupWorkspacesCli, { provide: WorkspaceCleanupService, useValue: cleanup }],
    }).compile()
    return { command: moduleRef.get(RunCleanupWorkspacesCli), cleanup }
}

describe("RunCleanupWorkspacesCli", () => {
    it("hands the parsed options to the cleanup", async () => {
        const { command, cleanup } = await build()
        const options = { keep: "ws-1", execute: true, receiptDigest: "d" }

        await expect(command.run([], options)).resolves.toBeUndefined()

        expect(cleanup.run).toHaveBeenCalledWith(options)
    })

    it("hands an empty option set to the cleanup, which refuses it", async () => {
        const { command, cleanup } = await build()

        await command.run([])

        expect(cleanup.run).toHaveBeenCalledWith({})
    })

    it("answers the value of its options", async () => {
        const { command } = await build()

        expect(command.parseKeep("a,b")).toBe("a,b")
        expect(command.parseDryRun()).toBe(true)
        expect(command.parseExecute()).toBe(true)
        expect(command.parseAllowKeptCascade()).toBe(true)
        expect(command.parseReceiptDigest("d")).toBe("d")
    })
})
