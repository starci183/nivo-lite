import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { StdioConsoleClient, WorkspacePruneService } from "@modules/domain/workspaces"
import { RunPruneWorkspacesCli } from "./run.cli"

const build = async () => {
    const prune = mock<WorkspacePruneService>()
    const moduleRef = await Test.createTestingModule({
        providers: [RunPruneWorkspacesCli, { provide: WorkspacePruneService, useValue: prune }],
    }).compile()
    return { command: moduleRef.get(RunPruneWorkspacesCli), prune }
}

describe("RunPruneWorkspacesCli", () => {
    it("hands the parsed options to the prune", async () => {
        const { command, prune } = await build()
        const options = { keep: ["ws-1"], default: false, yes: true }

        await expect(command.run([], options)).resolves.toBeUndefined()

        expect(prune.prune).toHaveBeenCalledWith(options, expect.any(StdioConsoleClient))
    })

    it("runs with no options at all", async () => {
        const { command, prune } = await build()

        await command.run([])

        expect(prune.prune).toHaveBeenCalledWith({}, expect.any(StdioConsoleClient))
    })

    it("collects every keep id, from the first to the last", async () => {
        const { command } = await build()

        expect(command.collectKeep("a")).toEqual(["a"])
        expect(command.collectKeep("b", ["a"])).toEqual(["a", "b"])
    })

    it("answers the value of its flags", async () => {
        const { command } = await build()

        expect(command.dropDefault()).toBe(false)
        expect(command.assumeYes()).toBe(true)
    })
})
