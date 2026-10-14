import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { NivoFolderClient } from "./nivo-folder.client"
import { NIVO_KNOWLEDGE_FILES } from "./nivo-knowledge.templates"

describe("NivoFolderClient", () => {
    let folder: string

    beforeEach(async () => {
        folder = await mkdtemp(join(tmpdir(), "nivo-folder-"))
    })

    afterEach(async () => {
        await rm(folder, { recursive: true, force: true })
    })

    it("returns all shipped knowledge in path order without changing the resources", async () => {
        const original = [...NIVO_KNOWLEDGE_FILES]
        const expected = [...NIVO_KNOWLEDGE_FILES].sort((a, b) => a.path.localeCompare(b.path))

        await expect(new NivoFolderClient().read(undefined)).resolves.toEqual(expected)
        expect(NIVO_KNOWLEDGE_FILES).toEqual(original)
    })

    it("reads markdown recursively with relative forward-slash paths in sorted order", async () => {
        await mkdir(join(folder, "core", "nested"), { recursive: true })
        await mkdir(join(folder, "empty"))
        await writeFile(join(folder, "z.md"), "Last root file\n", "utf8")
        await writeFile(join(folder, "a.md"), "First root file", "utf8")
        await writeFile(join(folder, "core", "tone.md"), "Warm tone", "utf8")
        await writeFile(join(folder, "core", "nested", "authority.md"), "Evidence matters", "utf8")
        await writeFile(join(folder, "notes.txt"), "Skip ordinary text", "utf8")
        await writeFile(join(folder, "core", "nested", "upper.MD"), "Skip uppercase extension", "utf8")

        await expect(new NivoFolderClient().read(folder)).resolves.toEqual([
            { path: "a.md", text: "First root file" },
            { path: "core/nested/authority.md", text: "Evidence matters" },
            { path: "core/tone.md", text: "Warm tone" },
            { path: "z.md", text: "Last root file\n" },
        ])
    })

    it("answers an empty list for an empty folder", async () => {
        await expect(new NivoFolderClient().read(folder)).resolves.toEqual([])
    })

    it("propagates a missing-folder filesystem error", async () => {
        const missing = join(folder, "missing")

        await expect(new NivoFolderClient().read(missing)).rejects.toMatchObject({ code: "ENOENT", path: missing })
    })
})
