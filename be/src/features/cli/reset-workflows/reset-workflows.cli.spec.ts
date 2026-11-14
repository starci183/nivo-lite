import { readFile, readdir } from "node:fs/promises"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkflowResetCommandService } from "@modules/domain/workspace-seed"
import { ResetWorkflowsCli } from "./reset-workflows.cli"

const build = async () => {
    const commands = mock<WorkflowResetCommandService>()
    commands.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ResetWorkflowsCli, { provide: WorkflowResetCommandService, useValue: commands }],
    }).compile()
    return { cli: moduleRef.get(ResetWorkflowsCli), commands }
}

describe("ResetWorkflowsCli", () => {
    it("hands the options and the file system readers to the reset command", async () => {
        const { cli, commands } = await build()
        const options = { workspace: "NIVO", graphs: "graphs", dryRun: true }

        await expect(cli.run([], options)).resolves.toBeUndefined()

        expect(commands.run).toHaveBeenCalledWith(options, { readdir, readFile })
    })

    it("reads each option as it was typed", async () => {
        const { cli } = await build()

        expect(cli.parseWorkspace("NIVO")).toBe("NIVO")
        expect(cli.parseGraphs("graphs")).toBe("graphs")
        expect(cli.parseDryRun()).toBe(true)
    })
})
