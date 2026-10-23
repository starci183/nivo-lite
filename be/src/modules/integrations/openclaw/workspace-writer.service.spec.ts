import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawErrorCode } from "./errors/openclaw.error"
import { OPENCLAW_FILES } from "./openclaw.decorators"
import type { OpenclawFiles } from "./openclaw-files.port"
import { WorkspaceWriterService } from "./workspace-writer.service"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const ROOT = "/state/workspace-ws-1-chatbot"
const MANIFEST = `${ROOT}/.nivo-managed.json`
const AGENTS = { path: "AGENTS.md", content: "# Agent\n" }
const PRICES = { path: "knowledge/01-prices.md", content: "# Prices\n" }

/** A disk in memory: the files port over a map of path to text; a folder is empty when no path lies under it. */
const memoryFiles = () => {
    const store = new Map<string, string>()
    const files: Partial<OpenclawFiles> = {
        readText: jest.fn((path: string) => store.get(path) ?? null),
        writeText: jest.fn((path: string, content: string) => {
            store.set(path, content)
        }),
        remove: jest.fn((path: string) => {
            store.delete(path)
        }),
        removeDirectoryIfEmpty: jest.fn(
            (directory: string) => ![...store.keys()].some((path) => path.startsWith(`${directory}/`)),
        ),
    }
    return { files, store }
}

const build = async () => {
    const disk = memoryFiles()
    const files = mock<OpenclawFiles>(disk.files)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkspaceWriterService,
            { provide: OPENCLAW_FILES, useValue: files },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { writer: moduleRef.get(WorkspaceWriterService), disk, logger }
}

describe("WorkspaceWriterService", () => {
    it("lists a path once per file when the bundle repeats it", async () => {
        const { writer, disk } = await build()
        writer.write(ROOT, [AGENTS, AGENTS])
        expect(disk.store.get(MANIFEST)).toBe(JSON.stringify(["AGENTS.md", "AGENTS.md"], null, 2))
    })

    it("keeps manifest paths in locale-independent ordinal order", async () => {
        const { writer, disk } = await build()
        writer.write(
            ROOT,
            ["a.md", "Z.md", "A.md"].map((path) => ({ path, content: path })),
        )
        expect(disk.store.get(MANIFEST)).toBe(JSON.stringify(["A.md", "Z.md", "a.md"], null, 2))
    })

    describe("contentHash and metaOf", () => {
        it("hashes the bundle independent of file order", async () => {
            const { writer } = await build()

            expect(writer.contentHash([AGENTS, PRICES])).toBe(writer.contentHash([PRICES, AGENTS]))
            expect(writer.contentHash([AGENTS, PRICES])).not.toBe(writer.contentHash([AGENTS]))
        })

        it("records the byte size and the sha256 of each file", async () => {
            const { writer } = await build()

            expect(writer.metaOf([{ path: "a.md", content: "\u00e9" }])).toEqual([
                {
                    path: "a.md",
                    bytes: 2,
                    sha256: "4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c",
                },
            ])
        })
    })
})

describe("WorkspaceWriterService", () => {
    describe("write", () => {
        it("writes every file and a manifest, then writes nothing the second time", async () => {
            const { writer, disk } = await build()

            expect(writer.write(ROOT, [AGENTS, PRICES])).toEqual({ written: 2, removed: 0 })
            expect(disk.store.get(`${ROOT}/knowledge/01-prices.md`)).toBe("# Prices\n")
            expect(disk.store.get(MANIFEST)).toBe(JSON.stringify(["AGENTS.md", "knowledge/01-prices.md"], null, 2))
            expect(writer.write(ROOT, [AGENTS, PRICES])).toEqual({ written: 0, removed: 0 })
        })

        it("rewrites a changed file and removes a managed file the bundle dropped along with its empty folder", async () => {
            const { writer, disk } = await build()
            writer.write(ROOT, [AGENTS, PRICES])

            const result = writer.write(ROOT, [{ path: "AGENTS.md", content: "# Changed\n" }])

            expect(result).toEqual({ written: 1, removed: 1 })
            expect(disk.store.get(`${ROOT}/AGENTS.md`)).toBe("# Changed\n")
            expect(disk.store.has(`${ROOT}/knowledge/01-prices.md`)).toBe(false)
            expect(disk.files.removeDirectoryIfEmpty).toHaveBeenCalledWith(`${ROOT}/knowledge`)
        })

        it("stops pruning at a folder that still holds a file the agent wrote itself", async () => {
            const { writer, disk } = await build()
            writer.write(ROOT, [AGENTS, PRICES])
            disk.store.set(`${ROOT}/knowledge/memory.md`, "agent notes")

            writer.write(ROOT, [AGENTS])

            expect(disk.store.has(`${ROOT}/knowledge/memory.md`)).toBe(true)
            expect(disk.files.removeDirectoryIfEmpty).toHaveBeenCalledTimes(1)
        })

        it("refuses a path that leaves the workspace or names the manifest", async () => {
            const { writer } = await build()

            for (const path of [
                "",
                "../escape.md",
                "/abs.md",
                "C:/abs.md",
                ".nivo-managed.json",
                "a/../../b.md",
                "a\\b.md",
            ]) {
                expect(thrownBy(() => writer.write(ROOT, [{ path, content: "x" }]))).toEqual(
                    objectLike({ code: OpenclawErrorCode.WorkspacePathUnsafe }),
                )
            }
        })
    })
})

describe("WorkspaceWriterService", () => {
    describe("matches", () => {
        it("is true for an identical workspace and false for a changed, missing or stale one", async () => {
            const { writer } = await build()
            expect(writer.matches(ROOT, [AGENTS, PRICES])).toBe(false)

            writer.write(ROOT, [AGENTS, PRICES])
            expect(writer.matches(ROOT, [AGENTS, PRICES])).toBe(true)
            expect(writer.matches(ROOT, [{ path: "AGENTS.md", content: "different" }, PRICES])).toBe(false)
            expect(writer.matches(ROOT, [AGENTS])).toBe(false)
            expect(writer.matches(ROOT, [AGENTS, PRICES, { path: "new.md", content: "x" }])).toBe(false)
        })

        it("treats a manifest that is not a JSON list of paths as empty", async () => {
            const { writer, disk, logger } = await build()
            writer.write(ROOT, [AGENTS])

            disk.store.set(MANIFEST, "{ broken")
            expect(writer.matches(ROOT, [AGENTS])).toBe(true)
            expect(logger.error).toHaveBeenCalledTimes(1)

            disk.store.set(MANIFEST, '{"not":"an array"}')
            expect(writer.matches(ROOT, [AGENTS])).toBe(true)

            disk.store.set(MANIFEST, '["AGENTS.md", 7]')
            expect(writer.matches(ROOT, [AGENTS])).toBe(true)
        })
    })
})
