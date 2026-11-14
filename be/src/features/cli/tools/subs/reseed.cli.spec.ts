import { readFile } from "node:fs/promises"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ToolReseedCommandService } from "@modules/domain/tool-reseed"
import { ReseedToolsCli } from "./reseed.cli"

const build = async () => {
    const commands = mock<ToolReseedCommandService>()
    commands.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ReseedToolsCli, { provide: ToolReseedCommandService, useValue: commands }],
    }).compile()
    return { cli: moduleRef.get(ReseedToolsCli), commands }
}

describe("ReseedToolsCli", () => {
    it("hands the flags, stdout, the process and the file reader to the re-seed command", async () => {
        const { cli, commands } = await build()
        const flags = { workspace: "W", map: "m.json", execute: true }

        await cli.run([], flags)

        expect(commands.run).toHaveBeenCalledWith(process.stdout, process, flags, readFile)
    })

    it("hands no flags when the command line gave none", async () => {
        const { cli, commands } = await build()

        await cli.run([])

        expect(commands.run).toHaveBeenCalledWith(process.stdout, process, {}, readFile)
    })

    it("reads each flag as it was typed", async () => {
        const { cli } = await build()

        expect(cli.parseWorkspace("W")).toBe("W")
        expect(cli.parseMap("m.json")).toBe("m.json")
        expect(cli.parseDryRun()).toBe(true)
        expect(cli.parseExecute()).toBe(true)
    })
})
