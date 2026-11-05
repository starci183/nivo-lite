import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { ENTITY_PLANNER_OPTIONS } from "./entity-planner.port"
import { MigrationFilesClient } from "./migration-files.client"

const clientAt = async (root: string): Promise<MigrationFilesClient> => {
    const moduleRef = await Test.createTestingModule({
        providers: [MigrationFilesClient, { provide: ENTITY_PLANNER_OPTIONS, useValue: { entities: [], root } }],
    }).compile()
    return moduleRef.get(MigrationFilesClient)
}

const clientHere = async (): Promise<MigrationFilesClient> => {
    const moduleRef = await Test.createTestingModule({
        providers: [MigrationFilesClient, { provide: ENTITY_PLANNER_OPTIONS, useValue: { entities: [] } }],
    }).compile()
    return moduleRef.get(MigrationFilesClient)
}

/** Runs a test against a client whose root is a fresh temporary app folder with an empty migrations folder. */
const inTempRoot = async (run: (files: MigrationFilesClient, root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), "entity-planner-"))
    try {
        await mkdir(join(root, "db", "migrations"), { recursive: true })
        await run(await clientAt(root), root)
    } finally {
        await rm(root, { recursive: true, force: true })
    }
}

describe("MigrationFilesClient", () => {
    it("lists the sql files in name order and reads one", () =>
        inTempRoot(async (files, root) => {
            await writeFile(join(root, "db", "migrations", "2_b.sql"), "B")
            await writeFile(join(root, "db", "migrations", "1_a.sql"), "A")
            await writeFile(join(root, "db", "migrations", "notes.md"), "x")

            await expect(files.names()).resolves.toEqual(["1_a.sql", "2_b.sql"])
            await expect(files.read("2_b.sql")).resolves.toBe("B")
        }))

    it("writes a new migration and refuses to overwrite one", () =>
        inTempRoot(async (files, root) => {
            await files.write("3_c.sql", "C")

            await expect(readFile(join(root, "db", "migrations", "3_c.sql"), "utf8")).resolves.toBe("C")
            await expect(files.write("3_c.sql", "other")).rejects.toMatchObject({ code: "EEXIST" })
        }))

    it("reads the manifest, null before it exists, and writes it with its folder", () =>
        inTempRoot(async (files) => {
            await expect(files.manifest()).resolves.toBeNull()
            await files.writeManifest("{}\n")
            await expect(files.manifest()).resolves.toBe("{}\n")
        }))

    it("lets another read failure through", () =>
        inTempRoot(async (files, root) => {
            await mkdir(join(root, "db", "entities.manifest.json"), { recursive: true })

            await expect(files.manifest()).rejects.toMatchObject({ code: "EISDIR" })
        }))

    it("works from the working directory when no root is given", async () => {
        const files = await clientHere()

        await expect(files.names()).rejects.toMatchObject({ code: "ENOENT" })
    })
})
