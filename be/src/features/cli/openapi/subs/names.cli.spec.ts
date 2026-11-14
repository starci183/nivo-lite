import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { toolNamesOf, toolNamesTextOf } from "@modules/domain/openapi-tools"
import { NamesOpenApiCli } from "./names.cli"

const DOCUMENT = JSON.stringify({
    openapi: "3.0.3",
    info: { title: "t", version: "1" },
    servers: [{ url: "https://crm.example.test/v1" }],
    paths: { "/v1/customers/{code}": { get: { operationId: "customer.get", responses: { "200": { description: "ok" } } } } },
})

/** The CRM id the package is written against: given by the flag, never read from the document. */
const CRM = "nivoweb"

const build = async (): Promise<NamesOpenApiCli> => {
    const moduleRef = await Test.createTestingModule({ providers: [NamesOpenApiCli] }).compile()
    return moduleRef.get(NamesOpenApiCli)
}

const folder = { path: "" }
const documentFile = (): string => join(folder.path, "openapi.json")
const outFile = (): string => join(folder.path, "api.generated.ts")

/** The text the document gives. */
const expected = (): string => {
    const reading = toolNamesOf(DOCUMENT, CRM)
    return reading.ok ? toolNamesTextOf(CRM, reading) : ""
}

const MISSING = "openapi names: --crm <id>, --document <file> and --out <file> are required; nothing read\n"

beforeAll(async () => {
    folder.path = await mkdtemp(join(tmpdir(), "openapi-names-"))
    await writeFile(documentFile(), DOCUMENT, "utf8")
})

afterAll(async () => {
    await rm(folder.path, { recursive: true, force: true })
})

afterEach(() => {
    process.exitCode = undefined
    jest.restoreAllMocks()
})

describe("NamesOpenApiCli", () => {
    it("writes the names file the document gives under the CRM id of the flag, and --check then finds it matching", async () => {
        jest.spyOn(process.stdout, "write").mockReturnValue(true)
        const command = await build()

        await command.run([], { crm: CRM, document: documentFile(), out: outFile() })
        expect(await readFile(outFile(), "utf8")).toBe(expected())
        expect(expected()).toContain('"nivo.api.crm.nivoweb.get.customers.code"')
        expect(expected()).toContain('export const CRM_NIVOWEB_PROVIDER = "crm.nivoweb" as const')
        expect(process.exitCode).toBeUndefined()

        await command.run([], { crm: CRM, document: documentFile(), out: outFile(), check: true })
        expect(process.exitCode).toBeUndefined()
    })

    it("--check writes nothing and exits non-zero when the file on disk differs, or is absent", async () => {
        jest.spyOn(process.stdout, "write").mockReturnValue(true)
        const command = await build()
        await writeFile(outFile(), "// edited by hand\n", "utf8")

        await command.run([], { crm: CRM, document: documentFile(), out: outFile(), check: true })

        expect(process.exitCode).toBe(1)
        expect(await readFile(outFile(), "utf8")).toBe("// edited by hand\n")
        process.exitCode = undefined
        await command.run([], { crm: CRM, document: documentFile(), out: join(folder.path, "absent.ts"), check: true })
        expect(process.exitCode).toBe(1)
    })

    it("names the same document by another CRM id when the flag says so: the document never names its CRM", async () => {
        jest.spyOn(process.stdout, "write").mockReturnValue(true)
        const command = await build()
        const other = join(folder.path, "other.generated.ts")

        await command.run([], { crm: "shopcrm", document: documentFile(), out: other })

        const text = await readFile(other, "utf8")
        expect(text).toContain('"nivo.api.crm.shopcrm.get.customers.code"')
        expect(text).not.toContain("nivo.api.crm.nivoweb.")
    })

    it("reads nothing without its three flags, and writes nothing for a document or a CRM id that gives no names", async () => {
        const printed = jest.spyOn(process.stdout, "write").mockReturnValue(true)
        const command = await build()
        const broken = join(folder.path, "broken.json")
        await writeFile(broken, "{", "utf8")

        await command.run([], { crm: CRM, document: documentFile() })
        expect(printed).toHaveBeenLastCalledWith(MISSING)
        expect(process.exitCode).toBe(1)

        process.exitCode = undefined
        await command.run([], { document: documentFile(), out: join(folder.path, "never.ts") })
        expect(printed).toHaveBeenLastCalledWith(MISSING)
        expect(process.exitCode).toBe(1)

        process.exitCode = undefined
        await command.run([], { crm: CRM, document: broken, out: join(folder.path, "never.ts") })
        expect(printed).toHaveBeenLastCalledWith("openapi names: not_json; nothing written\n")
        expect(process.exitCode).toBe(1)

        process.exitCode = undefined
        await command.run([], { crm: "Nivo Web", document: documentFile(), out: join(folder.path, "never.ts") })
        expect(printed).toHaveBeenLastCalledWith("openapi names: crm_id_invalid; nothing written\n")
        expect(process.exitCode).toBe(1)
        await expect(readFile(join(folder.path, "never.ts"), "utf8")).rejects.toThrow()
    })
})
