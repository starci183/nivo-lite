import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OpenApiToolsOperatorService } from "@modules/domain/data-hub"
import { PinOpenApiCli } from "./pin.cli"

const DOCUMENT = '{"openapi":"3.0.3","info":{"title":"t","version":"1"},"servers":[{"url":"https://crm.example.test/v1"}],"paths":{}}'

const build = async () => {
    const operator = mock<OpenApiToolsOperatorService>()
    const moduleRef = await Test.createTestingModule({
        providers: [PinOpenApiCli, { provide: OpenApiToolsOperatorService, useValue: operator }],
    }).compile()
    return { command: moduleRef.get(PinOpenApiCli), operator }
}

const folder = { path: "" }
const file = (): string => join(folder.path, "openapi.json")

beforeAll(async () => {
    folder.path = await mkdtemp(join(tmpdir(), "openapi-pin-"))
    await writeFile(file(), DOCUMENT, "utf8")
})

afterAll(async () => {
    await rm(folder.path, { recursive: true, force: true })
})

describe("PinOpenApiCli", () => {
    it("is dry by default: it reads the document from the file named and hands its text, the CRM's provider key (crm.<id>) the --crm flag gives, the flags and stdout to the operator", async () => {
        const { command, operator } = await build()

        await command.run([], { workspace: "ws-1", connection: "conn-1", crm: "nivoweb", document: file() })

        expect(operator.pin.mock.calls).toEqual([
            [
                process.stdout,
                {
                    workspaceId: "ws-1",
                    connectionId: "conn-1",
                    connector: "crm.nivoweb",
                    swaggerUrl: "",
                    workspaceHeader: "X-Workspace-Id",
                    documentText: DOCUMENT,
                    live: false,
                    execute: undefined,
                },
            ],
        ])
    })

    it("hands --crm (the id the shop picked, as its provider key), --header, --live and --execute on", async () => {
        const { command, operator } = await build()

        await command.run([], {
            workspace: "ws-1",
            connection: "conn-1",
            crm: "shopcrm",
            document: file(),
            header: "X-Tenant",
            live: true,
            execute: true,
        })

        expect(operator.pin.mock.calls[0]?.[1]).toMatchObject({
            connector: "crm.shopcrm",
            workspaceHeader: "X-Tenant",
            live: true,
            execute: true,
        })
    })

})

describe("PinOpenApiCli (refusals)", () => {
    it("reads nothing without the workspace, the connection, the CRM id and the document", async () => {
        const { command, operator } = await build()
        const written = jest.spyOn(process.stdout, "write").mockReturnValue(true)

        await command.run([], { workspace: "ws-1", connection: "conn-1", crm: "nivoweb", execute: true })
        await command.run([], { connection: "conn-1", crm: "nivoweb", document: file() })
        await command.run([], { workspace: "ws-1", connection: "conn-1", document: file() })

        expect(operator.pin).not.toHaveBeenCalled()
        expect(written).toHaveBeenCalledTimes(3)
        expect(written).toHaveBeenCalledWith(expect.stringContaining("--crm <id>"))
        expect(written).toHaveBeenCalledWith(expect.stringContaining("are required; nothing read"))
        written.mockRestore()
    })

    it("never reads the CRM id from the document: a document that states another source key is handed on under the --crm given", async () => {
        const { command, operator } = await build()
        const stated = join(folder.path, "stated.json")
        await writeFile(stated, '{"openapi":"3.0.3","info":{"x-nivo-source":{"key":"other","basePath":"/v1"}},"paths":{}}', "utf8")

        await command.run([], { workspace: "ws-1", connection: "conn-1", crm: "nivoweb", document: stated })

        expect(operator.pin.mock.calls[0]?.[1]).toMatchObject({ connector: "crm.nivoweb" })
    })

    it("hands a CRM id that is malformed on as its provider key, so the pin refuses it (crm_id_invalid)", async () => {
        const { command, operator } = await build()

        await command.run([], { workspace: "ws-1", connection: "conn-1", crm: "Nivo Web", document: file() })

        expect(operator.pin.mock.calls[0]?.[1]).toMatchObject({ connector: "crm.Nivo Web" })
    })

    it("fails, pinning nothing, when the file cannot be read", async () => {
        const { command, operator } = await build()
        const missing = join(folder.path, "absent.json")

        await expect(
            command.run([], { workspace: "ws-1", connection: "conn-1", crm: "nivoweb", document: missing }),
        ).rejects.toMatchObject({ code: "ENOENT" })
        expect(operator.pin).not.toHaveBeenCalled()
    })

})

describe("PinOpenApiCli (flags)", () => {
    it("reads its flags as typed", async () => {
        const { command } = await build()

        expect([
            command.parseWorkspace("ws-9"),
            command.parseConnection("conn-9"),
            command.parseCrm("nivoweb"),
            command.parseDocument("a.json"),
            command.parseHeader("X-Tenant"),
            command.parseLive(),
            command.parseExecute(),
        ]).toEqual(["ws-9", "conn-9", "nivoweb", "a.json", "X-Tenant", true, true])
    })
})
