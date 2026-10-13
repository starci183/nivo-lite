import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { NodeFilesClient } from "./node-files.client"

/** A folder name of its own per test, under the system temp folder. */
const ownFolder = (): string => join(tmpdir(), `openclaw-files-${process.pid}-${Math.random().toString(36).slice(2)}`)

const build = async (): Promise<NodeFilesClient> =>
    (await Test.createTestingModule({ providers: [NodeFilesClient] }).compile()).get(NodeFilesClient)

describe("NodeFilesClient", () => {
    it("writes a file with its folders, reads it back, overwrites it and leaves no temp file", async () => {
        const files = await build()
        const root = ownFolder()
        const target = join(root, "knowledge", "a.md")

        files.writeText(target, "first", 0o644)
        files.writeText(target, "second", 0o644)

        expect(files.readText(target)).toBe("second")
        expect(files.exists(target)).toBe(true)
        expect(files.listNames(join(root, "knowledge"))).toEqual(["a.md"])

        files.remove(target)
        expect(files.removeDirectoryIfEmpty(join(root, "knowledge"))).toBe(true)
        expect(files.removeDirectoryIfEmpty(root)).toBe(true)
    })

    it("answers nothing for a path that is not there", async () => {
        const files = await build()
        const missing = join(ownFolder(), "none.md")

        expect(files.readText(missing)).toBeNull()
        expect(files.exists(missing)).toBe(false)
        expect(files.listNames(join(missing, ".."))).toEqual([])
        expect(files.removeDirectoryIfEmpty(join(missing, ".."))).toBe(false)
        expect(() => files.remove(missing)).not.toThrow()
    })

    it("keeps a folder that still holds a file", async () => {
        const files = await build()
        const root = ownFolder()
        const target = join(root, "memory.md")
        files.writeText(target, "notes", 0o644)

        expect(files.removeDirectoryIfEmpty(root)).toBe(false)

        files.remove(target)
        expect(files.removeDirectoryIfEmpty(root)).toBe(true)
    })
})
