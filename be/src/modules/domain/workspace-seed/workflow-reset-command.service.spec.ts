import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkflowResetCommandService } from "./workflow-reset-command.service"
import { WorkflowResetService } from "./workflow-reset.service"

const FILES = { readdir, readFile }

const build = async () => {
    const reset = mock<WorkflowResetService>()
    reset.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [WorkflowResetCommandService, { provide: WorkflowResetService, useValue: reset }],
    }).compile()
    return { commands: moduleRef.get(WorkflowResetCommandService), reset }
}

describe("WorkflowResetCommandService.run", () => {
    let folder = ""

    beforeEach(async () => {
        folder = await mkdtemp(join(tmpdir(), "reset-workflows-"))
    })

    afterEach(async () => {
        await rm(folder, { recursive: true, force: true })
    })

    it("reads every .json graph of the folder in name order into one envelope and hands it to the reset with the workspace", async () => {
        await writeFile(join(folder, "sales.json"), '{"moduleKey":"sales"}')
        await writeFile(join(folder, "accounting.json"), '{"moduleKey":"accounting"}')
        await writeFile(join(folder, "notes.txt"), "not a graph")
        await mkdir(join(folder, "nested.json.d"))
        const { commands, reset } = await build()

        await expect(commands.run({ workspace: "NIVO", graphs: folder }, FILES)).resolves.toBeUndefined()

        expect(reset.run.mock.calls).toEqual([
            [
                JSON.stringify({ documents: [{ document: { moduleKey: "accounting" } }, { document: { moduleKey: "sales" } }] }),
                "NIVO",
            ],
        ])
    })

    it("hands the reset an empty envelope for an empty folder", async () => {
        const { commands, reset } = await build()

        await commands.run({ workspace: "NIVO", graphs: folder }, FILES)

        expect(reset.run.mock.calls).toEqual([['{"documents":[]}', "NIVO"]])
    })

    it("names no workspace when none was given, so the reset refuses it", async () => {
        const { commands, reset } = await build()

        await commands.run({ workspace: "", graphs: folder }, FILES)

        expect(reset.run.mock.calls[0]?.[1]).toBe("")
    })

    it("asks the reset for a dry run when dryRun is set", async () => {
        const { commands, reset } = await build()

        await commands.run({ workspace: "NIVO", graphs: folder, dryRun: true }, FILES)

        expect(reset.run.mock.calls).toEqual([['{"documents":[]}', "NIVO", { dryRun: true }]])
    })

    it("fails when the folder does not exist, and resets nothing", async () => {
        const { commands, reset } = await build()

        await expect(commands.run({ workspace: "NIVO", graphs: join(folder, "missing") }, FILES)).rejects.toThrow()

        expect(reset.run).not.toHaveBeenCalled()
    })

    it("fails on a graph file that is not JSON, and resets nothing", async () => {
        await writeFile(join(folder, "broken.json"), "{")
        const { commands, reset } = await build()

        await expect(commands.run({ workspace: "NIVO", graphs: folder }, FILES)).rejects.toThrow()

        expect(reset.run).not.toHaveBeenCalled()
    })
})
