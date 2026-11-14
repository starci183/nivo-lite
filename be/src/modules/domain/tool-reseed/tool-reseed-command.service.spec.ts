import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ReseedExit, ReseedReport } from "./tool-reseed.contracts"
import { ToolReseedCommandService } from "./tool-reseed-command.service"
import { ToolReseedService } from "./tool-reseed.service"

const reportOf = (over: Partial<ReseedReport>): ReseedReport => ({
    executed: false,
    refusal: null,
    mapPath: "m",
    workspaces: [],
    totals: {
        workflows: { found: 0, rewritten: 0, removed: 0, orphans: 0 },
        graphs: { found: 0, rewritten: 0, removed: 0, orphans: 0 },
        tool_grants: { found: 0, rewritten: 0, removed: 0, orphans: 0 },
    },
    failed: 0,
    ...over,
})

const build = async (report: ReseedReport) => {
    const reseeds = mock<ToolReseedService>()
    reseeds.reseedFor.mockResolvedValue(report)
    const moduleRef = await Test.createTestingModule({
        providers: [ToolReseedCommandService, { provide: ToolReseedService, useValue: reseeds }],
    }).compile()
    const out = { write: jest.fn() }
    const exit: ReseedExit = {}
    return { commands: moduleRef.get(ToolReseedCommandService), reseeds, out, exit }
}

describe("ToolReseedCommandService.run", () => {
    let folder = ""

    beforeEach(async () => {
        folder = await mkdtemp(join(tmpdir(), "tools-reseed-"))
    })

    afterEach(async () => {
        await rm(folder, { recursive: true, force: true })
    })

    it.each([
        { name: "dry by default", flags: {}, execute: undefined },
        { name: "dry with --dry-run", flags: { dryRun: true }, execute: undefined },
        { name: "writes with --execute", flags: { execute: true }, execute: true },
    ])("$name: hands the map's JSON, the workspace and the mode to the re-seed", async ({ flags, execute }) => {
        const path = join(folder, "map.json")
        await writeFile(path, '{"tools":{"a.b":"nivo.tool.a.b"}}')
        const { commands, reseeds, out, exit } = await build(reportOf({}))

        await commands.run(out, exit, { ...flags, workspace: "W", map: path }, readFile)

        expect(reseeds.reseedFor).toHaveBeenCalledWith(out, {
            workspaceId: "W",
            execute,
            map: { json: { tools: { "a.b": "nivo.tool.a.b" } }, path },
        })
        expect(exit.exitCode).toBeUndefined()
    })

    it("hands a map it cannot read as null, so the re-seed refuses it", async () => {
        const { commands, reseeds, out, exit } = await build(reportOf({ refusal: "bad_map" }))

        await commands.run(out, exit, { map: join(folder, "missing.json") }, readFile)

        expect(reseeds.reseedFor.mock.calls[0]?.[1].map.json).toBeNull()
        expect(exit.exitCode).toBe(1)
    })

    it("hands a map that is not JSON as null", async () => {
        const path = join(folder, "bad.json")
        await writeFile(path, "{not json")
        const { commands, reseeds, out, exit } = await build(reportOf({ refusal: "bad_map" }))

        await commands.run(out, exit, { map: path }, readFile)

        expect(reseeds.reseedFor.mock.calls[0]?.[1].map.json).toBeNull()
    })

    it("reads the lane's rename map when no --map is given", async () => {
        const { commands, reseeds, out, exit } = await build(reportOf({}))
        const readText = jest.fn().mockResolvedValue("{}")

        await commands.run(out, exit, {}, readText)

        expect(readText).toHaveBeenCalledWith("scripts/tool-rename-20261112.json", "utf8")
        expect(reseeds.reseedFor.mock.calls[0]?.[1].map.path).toBe("scripts/tool-rename-20261112.json")
    })

    it("refuses --dry-run with --execute, prints why, reads and runs nothing", async () => {
        const { commands, reseeds, out, exit } = await build(reportOf({}))
        const readText = jest.fn()

        await commands.run(out, exit, { dryRun: true, execute: true }, readText)

        expect(out.write).toHaveBeenCalledWith("tools reseed: give --dry-run (the default) or --execute, not both; nothing read\n")
        expect(readText).not.toHaveBeenCalled()
        expect(reseeds.reseedFor).not.toHaveBeenCalled()
        expect(exit.exitCode).toBe(1)
    })

    it("ends non-zero when an agent failed", async () => {
        const { commands, out, exit } = await build(reportOf({ executed: true, failed: 2 }))

        await commands.run(out, exit, { execute: true, workspace: "W" }, jest.fn().mockResolvedValue("{}"))

        expect(exit.exitCode).toBe(1)
    })
})
