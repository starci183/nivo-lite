import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ToolsError, ToolsErrorCode } from "@modules/domain/tools"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { OpenApiNativeService } from "./openapi-connection-native.service"
import { OpenApiInterfaceReadsService, interfaceAnswerOf } from "./openapi-workbench.service"

const VIEWER = { workspaceId: "ws-1", memberId: "member-1" }
const PAGE_SCHEMA = { type: "object", properties: { items: { type: "array", items: { type: "object", required: ["code"] } } } }

/** The API reads the scripted connector's pinned document serves: two pages and a record. */
const FIND = "nivo.api.crm.nivoweb.get.customers"
const GET = "nivo.api.crm.nivoweb.get.customers.code"
const INVOICES = "nivo.api.crm.nivoweb.get.invoices"

/**
 * The provider over a scripted connector of the CRM `crm.nivoweb` (the one the installed NIVO Web plugin declares), in a workspace whose
 * modules' agents hold the given tools; `open` says whether the plugin of those modules is open to the workspace.
 */
const build = async (openTools: ReadonlyArray<string>, open = true) => {
    const crm = mock<OpenApiNativeService>()
    crm.viewerReads.mockResolvedValue([
        { name: FIND, input: { type: "object" }, output: PAGE_SCHEMA },
        { name: GET, input: { type: "object" }, output: { type: "object" } },
        { name: INVOICES, input: { type: "object" }, output: PAGE_SCHEMA },
    ])
    crm.viewerRead.mockResolvedValue({ ok: true, status: 200, data: { items: [{ code: "ACME" }], nextCursor: "c2" }, truncated: false, omitted: 0 })
    const bindings = mock<ConnectionBindingsReadService>()
    const enterprise = mock<WorkspaceEnterpriseService>()
    enterprise.keyOf.mockResolvedValue("nivo-web")
    jest.spyOn(INSTALLED, "agentToolsOf").mockReturnValue(openTools)
    jest.spyOn(INSTALLED, "isOpenTo").mockReturnValue(open)
    const moduleRef = await Test.createTestingModule({
        providers: [
            OpenApiInterfaceReadsService,
            { provide: OpenApiNativeService, useValue: crm },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: WorkspaceEnterpriseService, useValue: enterprise },
        ],
    }).compile()
    return { service: moduleRef.get(OpenApiInterfaceReadsService), crm, enterprise, bindings }
}

describe("OpenApiInterfaceReadsService", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("offers one generated read per GET operation of the pinned document, named by its API read and shaped from its schema", async () => {
        const { service, enterprise } = await build(["nivo.api.crm.nivoweb.get.customers"])

        await expect(service.readsOf("ws-1")).resolves.toEqual([
            { name: FIND, shape: "page", input: { type: "object" }, output: { type: "object", required: ["code"] } },
            { name: GET, shape: "record", input: { type: "object" }, output: { type: "object" } },
            { name: INVOICES, shape: "page", input: { type: "object" }, output: { type: "object", required: ["code"] } },
        ])
        expect(enterprise.keyOf).toHaveBeenCalledWith("ws-1")
    })

    it("offers a read of an open source whatever tool an agent holds, and a member reads it", async () => {
        const { service, crm } = await build(["nivo.api.crm.nivoweb.get.customers.code.balance"])

        const offered = await service.readsOf("ws-1")
        const answer = await service.read(VIEWER, INVOICES, { limit: 20 })

        expect(offered.map((read) => read.name)).toContain(INVOICES)
        expect(answer).toMatchObject({ kind: "page", rows: [{ code: "ACME" }] })
        expect(crm.viewerRead).toHaveBeenCalledWith("ws-1", INVOICES, { limit: 20 })
    })

    it("runs no read named by a tool id or of a source no open module uses", async () => {
        const { service, crm } = await build(["nivo.api.crm.nivoweb.get.customers"])
        const refused = { code: ToolsErrorCode.NativeRefused, params: { reason: "not_selected" } }

        await expect(service.read(VIEWER, "nivo.tool.invoice.create", {})).rejects.toMatchObject(refused)
        await expect(service.read(VIEWER, "nivo.api.crm.other.get.orders", {})).rejects.toMatchObject(refused)
        expect(crm.viewerRead).not.toHaveBeenCalled()
    })

    it("gives a workspace the private plugin does not name nothing: no read offered, none run", async () => {
        const { service, crm } = await build(["nivo.api.crm.nivoweb.get.customers", "nivo.api.crm.nivoweb.get.customers.code"], false)

        await expect(service.readsOf("ws-2")).resolves.toEqual([])
        await expect(service.read({ workspaceId: "ws-2", memberId: "member-9" }, FIND, { q: "an" })).rejects.toMatchObject({
            code: ToolsErrorCode.NativeRefused,
            params: { reason: "not_selected" },
        })
        expect(crm.viewerReads).not.toHaveBeenCalled()
        expect(crm.viewerRead).not.toHaveBeenCalled()
        await expect((await build([])).service.readsOf("ws-1")).resolves.toEqual([])
    })

    it("offers nothing in a workspace with no account, and stops when the document is not the pinned one", async () => {
        const { service, crm } = await build(["nivo.api.crm.nivoweb.get.customers"])
        crm.viewerReads.mockRejectedValue(new ToolsError({ code: ToolsErrorCode.NativeRefused, params: { reason: "not_connected" } }))
        crm.viewerRead.mockRejectedValue(new ToolsError({ code: ToolsErrorCode.NativeRefused, params: { reason: "document_changed" } }))

        await expect(service.readsOf("ws-1")).resolves.toEqual([])
        await expect(service.read(VIEWER, FIND, { q: "an" })).rejects.toMatchObject({ params: { reason: "document_changed" } })
    })

    it("runs a read through the provider's own client and answers a page a table takes", async () => {
        const { service, crm } = await build(["nivo.api.crm.nivoweb.get.customers"])

        await expect(service.read(VIEWER, FIND, { q: "an", cursor: "c1", limit: 20 })).resolves.toEqual({
            kind: "page",
            rows: [{ code: "ACME" }],
            cursor: "c2",
            truncated: false,
            omitted: 0,
        })
        expect(crm.viewerRead).toHaveBeenCalledWith("ws-1", FIND, { q: "an", cursor: "c1", limit: 20 })
    })
})

describe("interfaceAnswerOf", () => {
    it("answers a cut page without a cursor, one record, and the outside system's refusal", () => {
        const cut = { ok: true, data: { items: [{ code: "A" }], nextCursor: null }, truncated: true, omitted: 3 }

        expect(interfaceAnswerOf(cut)).toEqual({ kind: "page", rows: [{ code: "A" }], cursor: null, truncated: true, omitted: 3 })
        expect(interfaceAnswerOf({ ok: true, data: { code: "A" }, truncated: false })).toEqual({ kind: "record", record: { code: "A" }, truncated: false })
        expect(interfaceAnswerOf({ ok: false, status: 404, code: "CUSTOMER_NOT_FOUND", message: "No such customer" })).toEqual({
            kind: "refused",
            code: "CUSTOMER_NOT_FOUND",
            message: "No such customer",
        })
    })
})

describe("OpenApiInterfaceReadsService info", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("draws an API account from its connection alone, and knows no account of another provider or workspace", async () => {
        const { service, bindings, crm } = await build([])
        const facts = { v: 1, connector: "crm.nivoweb", swaggerUrl: "https://crm.example.test/v1/openapi.json", workspaceHeader: "X-Workspace-Id", documentSha256: "a".repeat(64), live: false, pinnedBy: "m", pinnedAt: "2026-11-12T00:00:00.000Z" }
        const base = {
            workspaceId: "ws-1",
            name: "CRM",
            status: "connected" as const,
            lastError: null,
            lastEventAt: null,
            environment: "live" as const,
            sandbox: false,
            isDefault: false,
            firstEvent: null,
            createdBy: null,
            createdAt: "2026-11-01T00:00:00.000Z",
        }
        bindings.recordOf.mockResolvedValueOnce({ ...base, id: "c-1", provider: "openapi", meta: { agentTools: JSON.stringify(facts) } })
        bindings.recordOf.mockResolvedValueOnce({ ...base, id: "c-2", provider: "imap", meta: {} })
        bindings.recordOf.mockResolvedValueOnce(null)

        const info = await service.infoOf("ws-1", "c-1")

        expect(info).toMatchObject({ connectionId: "c-1", state: "ok" })
        expect(info?.figures.map((figure) => [figure.key, figure.value])).toEqual([
            ["connector", "crm.nivoweb"],
            ["document", "aaaaaaaaaaaa"],
            ["pinned_at", "2026-11-12T00:00:00.000Z"],
            ["tools_ready", 0],
            ["tools_declared", 0],
            ["writes", "off"],
        ])
        await expect(service.infoOf("ws-1", "c-2")).resolves.toBeNull()
        await expect(service.infoOf("ws-2", "c-1")).resolves.toBeNull()
        expect(crm.viewerRead).not.toHaveBeenCalled()
    })
})
