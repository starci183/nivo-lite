import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { OpenclawErrorCode } from "./errors/openclaw.error"
import { WorkspaceWriterService } from "./workspace-writer.service"

const files = [
    { path: "AGENTS.md", content: "# Agent\n" },
    { path: "knowledge/01-prices.md", content: "# Prices\n" },
]

describe("WorkspaceWriterService", () => {
    let root = ""

    beforeEach(() => {
        root = join(mkdtempSync(join(tmpdir(), "openclaw-writer-")), "workspace")
    })

    afterEach(() => {
        rmSync(join(root, ".."), { recursive: true, force: true })
    })

    const build = async () =>
        (await Test.createTestingModule({ providers: [WorkspaceWriterService] }).compile()).get(WorkspaceWriterService)

    describe("contentHash and metaOf", () => {
        it("hashes the bundle independent of file order and records size and hash per file", async () => {
            const writer = await build()

            expect(writer.contentHash(files)).toBe(writer.contentHash([...files].reverse()))
            expect(writer.contentHash(files)).not.toBe(writer.contentHash([files[0] as never]))
            expect(writer.metaOf([{ path: "a.md", content: "é" }])).toEqual([
                { path: "a.md", bytes: 2, sha256: expect.stringMatching(/^[0-9a-f]{64}$/u) },
            ])
        })
    })

    describe("write", () => {
        it("writes every file and a manifest, then writes nothing the second time", async () => {
            const writer = await build()

            expect(writer.write(root, files)).toEqual({ written: 2, removed: 0 })
            expect(readFileSync(join(root, "knowledge/01-prices.md"), "utf8")).toBe("# Prices\n")
            expect(JSON.parse(readFileSync(join(root, ".nivo-managed.json"), "utf8"))).toEqual([
                "AGENTS.md",
                "knowledge/01-prices.md",
            ])
            expect(writer.write(root, files)).toEqual({ written: 0, removed: 0 })
        })

        it("rewrites a changed file and removes a managed file the bundle dropped along with its empty folder", async () => {
            const writer = await build()
            writer.write(root, files)

            const result = writer.write(root, [{ path: "AGENTS.md", content: "# Changed\n" }])

            expect(result).toEqual({ written: 1, removed: 1 })
            expect(readFileSync(join(root, "AGENTS.md"), "utf8")).toBe("# Changed\n")
            expect(existsSync(join(root, "knowledge"))).toBe(false)
        })

        it("keeps a folder that still holds a file the agent wrote itself", async () => {
            const writer = await build()
            writer.write(root, files)
            writeFileSync(join(root, "knowledge/memory.md"), "agent notes")

            writer.write(root, [files[0] as never])

            expect(existsSync(join(root, "knowledge/memory.md"))).toBe(true)
        })

        it("refuses a path that leaves the workspace or names the manifest", async () => {
            const writer = await build()

            for (const path of ["", "../escape.md", "/abs.md", "C:/abs.md", ".nivo-managed.json", "a/../../b.md"]) {
                expect(() => writer.write(root, [{ path, content: "x" }])).toThrow(
                    expect.objectContaining({ code: OpenclawErrorCode.WorkspacePathUnsafe }),
                )
            }
        })
    })

    describe("matches", () => {
        it("is true for an identical workspace and false for a changed, missing or stale one", async () => {
            const writer = await build()
            expect(writer.matches(root, files)).toBe(false)

            writer.write(root, files)
            expect(writer.matches(root, files)).toBe(true)
            expect(writer.matches(root, [{ path: "AGENTS.md", content: "different" }, files[1] as never])).toBe(false)
            expect(writer.matches(root, [files[0] as never])).toBe(false)
            expect(writer.matches(root, [...files, { path: "new.md", content: "x" }])).toBe(false)
        })

        it("is false when a bundle path is unsafe and tolerates a broken manifest", async () => {
            const writer = await build()
            writer.write(root, files)
            expect(writer.matches(root, [{ path: "../x", content: "x" }])).toBe(false)

            writeFileSync(join(root, ".nivo-managed.json"), "{ broken")
            expect(writer.matches(root, files)).toBe(true)
            writeFileSync(join(root, ".nivo-managed.json"), '{"not":"an array"}')
            expect(writer.matches(root, files)).toBe(true)
            mkdirSync(join(root, "extra"), { recursive: true })
            expect(writer.matches(root, files)).toBe(true)
        })
    })
})
