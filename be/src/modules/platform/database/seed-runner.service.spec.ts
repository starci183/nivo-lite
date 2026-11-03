import fsPromises from "node:fs/promises"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "./primary.decorators"
import { DEFAULT_SEED_ENV, SeedRunnerService, seedDirectoryOf } from "./seed-runner.service"

const SHARED = ".starcistacks/seeds/sql"
const OWN = ".starcistacks/dev/seeds/sql"
const REFERENCE = "INSERT INTO public.calendars (id, owner_id) VALUES ('calendar-1', 'person-1');\n"
const OWN_ROWS = "INSERT INTO public.calendars (id, owner_id) VALUES ('calendar-2', 'person-2');\n"

/** The folders the runner reads and the text of the files in them. */
type Folders = Readonly<Record<string, Readonly<Record<string, string>>>>

const build = async (entityManager: MockEntityManager, folders: Folders) => {
    jest.spyOn(fsPromises, "readdir").mockImplementation((directory) => {
        const files = folders[String(directory).replaceAll("\\", "/")]
        if (files === undefined) return Promise.reject(Object.assign(new Error("no such folder"), { code: "ENOENT" }))
        return Promise.resolve(Object.keys(files) as never)
    })
    jest.spyOn(fsPromises, "readFile").mockImplementation((file) => {
        const path = String(file).replaceAll("\\", "/")
        const text = Object.values(folders).flatMap((files) =>
            Object.entries(files).filter(([name]) => path.endsWith(`/${name}`)),
        )[0]?.[1]
        return Promise.resolve(text ?? "")
    })
    const moduleRef = await Test.createTestingModule({
        providers: [SeedRunnerService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(SeedRunnerService)
}

describe("seedDirectoryOf", () => {
    it("names the shared level without an environment and the level of the environment with one", () => {
        expect(seedDirectoryOf().replaceAll("\\", "/")).toBe(SHARED)
        expect(seedDirectoryOf("dev").replaceAll("\\", "/")).toBe(OWN)
        expect(DEFAULT_SEED_ENV).toBe("dev")
    })
})

describe("SeedRunnerService", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("runs the shared files first and then those of the environment, each in name order", async () => {
        const em = mockEntityManager({
            query: [
                [REFERENCE, []],
                [OWN_ROWS, []],
            ],
        })
        const runner = await build(em, {
            [SHARED]: { "reference.sql": REFERENCE, "readme.md": "ignored" },
            [OWN]: { "demo.sql": OWN_ROWS },
        })

        await runner.run()

        expect(em.query.mock.calls).toEqual([[REFERENCE], [OWN_ROWS]])
    })

    it("runs nothing for a folder that is absent or a file that holds no statement", async () => {
        const em = mockEntityManager()
        const runner = await build(em, { [SHARED]: { "blank.sql": "  \n\t" } })

        await runner.run("staging")

        expect(em.query).not.toHaveBeenCalled()
    })

    it("fails when a seed folder cannot be read", async () => {
        const em = mockEntityManager()
        const runner = await build(em, {})
        const failure = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" })
        jest.spyOn(fsPromises, "readdir").mockRejectedValue(failure)

        await expect(runner.run()).rejects.toBe(failure)
        expect(em.query).not.toHaveBeenCalled()
    })
})
