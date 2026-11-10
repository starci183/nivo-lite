import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WorkflowResetService } from "@modules/domain/workspace-seed"
import { ResetWorkflowsCli } from "./reset-workflows.cli"

const build = async () => {
    const reset = mock<WorkflowResetService>()
    reset.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ResetWorkflowsCli, { provide: WorkflowResetService, useValue: reset }],
    }).compile()
    return { cli: moduleRef.get(ResetWorkflowsCli), reset }
}

describe("ResetWorkflowsCli", () => {
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
        const { cli, reset } = await build()

        await expect(
            cli.run([], { workspace: cli.parseWorkspace("NIVO"), graphs: cli.parseGraphs(folder) }),
        ).resolves.toBeUndefined()

        expect(reset.run.mock.calls).toEqual([
            [
                JSON.stringify({ documents: [{ document: { moduleKey: "accounting" } }, { document: { moduleKey: "sales" } }] }),
                "NIVO",
            ],
        ])
    })

    it("hands the reset an empty envelope for an empty folder", async () => {
        const { cli, reset } = await build()

        await cli.run([], { workspace: "NIVO", graphs: folder })

        expect(reset.run.mock.calls).toEqual([['{"documents":[]}', "NIVO"]])
    })

    it("names no workspace when none was given, so the reset refuses it", async () => {
        const { cli, reset } = await build()

        await cli.run([], { workspace: "", graphs: folder })

        expect(reset.run.mock.calls[0]?.[1]).toBe("")
    })

    it("asks the reset for a dry run when --dry-run is given", async () => {
        const { cli, reset } = await build()

        await cli.run([], { workspace: "NIVO", graphs: folder, dryRun: cli.parseDryRun() })

        expect(reset.run.mock.calls).toEqual([['{"documents":[]}', "NIVO", { dryRun: true }]])
    })

    it("fails when the folder does not exist, and resets nothing", async () => {
        const { cli, reset } = await build()

        await expect(cli.run([], { workspace: "NIVO", graphs: join(folder, "missing") })).rejects.toThrow()

        expect(reset.run).not.toHaveBeenCalled()
    })

    it("fails on a graph file that is not JSON, and resets nothing", async () => {
        await writeFile(join(folder, "broken.json"), "{")
        const { cli, reset } = await build()

        await expect(cli.run([], { workspace: "NIVO", graphs: folder })).rejects.toThrow()

        expect(reset.run).not.toHaveBeenCalled()
    })
})
