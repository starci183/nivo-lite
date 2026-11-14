import { Test } from "@nestjs/testing"

jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const crm: typeof import("@tests/fixtures/builders/openapi-tools-pin.builder") = jest.requireActual(
        "@tests/fixtures/builders/openapi-tools-pin.builder",
    )
    return { installed: parts.installationWith([crm.CRM_SOURCE_PLUGIN], "crm-source") }
})

import { FakeClock, mock } from "@starci/jest-preset"
import { jsonTextOf } from "@tests/fixtures/builders/json-text.builder"
import { connectionStatusOf } from "@tests/fixtures/builders/customer-link-native.builder"
import { connectionRecordOf } from "@tests/fixtures/builders/inbox-lead-links.builder"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { accountFactsOf, pinnedOpsOf, pinnedTextOf } from "@modules/domain/openapi-tools"
import { CLOCK } from "@modules/platform/clock"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubErrorCode } from "./errors/data-hub.error"
import { OpenApiToolsPinService } from "./openapi-tools-pin.service"
import type { OpenApiToolsPinDraft } from "./openapi-tools-pin.service"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }
const NOW = new Date("2026-11-12T08:00:00.000Z")
/** The CRM the fixture plugin is written against (`crm.acme`): its operations are `nivo.api.crm.acme.<method>.<path>`. */
const CONNECTOR = "crm.acme"
const SWAGGER_URL = "https://crm.example.test/v1/openapi.json"
const DOCUMENT = {
    openapi: "3.0.3",
    info: { title: "CRM", version: "1" },
    servers: [{ url: "https://crm.example.test/v1" }],
    paths: {
        "/v1/customers/{code}": {
            get: {
                parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
                responses: {},
            },
        },
        "/v1/things": { get: { operationId: "thing.list", responses: {} } },
    },
}
const CONFIG = JSON.stringify({ v: 1, baseUrl: "https://crm.example.test", authType: "header", authName: "X-Crm-Service-Key" })

const connectionOf = (meta: Record<string, string>): DataConnection => ({
    id: "connection-1",
    workspaceId: "workspace-1",
    provider: "openapi",
    name: "CRM",
    status: "connected",
    lastError: null,
    meta,
    everyMinutes: 60,
    lastSyncAt: null,
})

const DRAFT: OpenApiToolsPinDraft = {
    connectionId: "connection-1",
    connector: CONNECTOR,
    swaggerUrl: SWAGGER_URL,
    workspaceHeader: "X-Workspace-Id",
    documentText: JSON.stringify(DOCUMENT),
    live: false,
}

const build = async (meta: Record<string, string> = { config: CONFIG, summary: "kept" }) => {
    const hub = mock<DataHubService>()
    const bindings = mock<ConnectionBindingsReadService>()
    hub.own.mockResolvedValue(connectionOf(meta))
    bindings.ofProvider.mockResolvedValue([])
    bindings.recordOf.mockResolvedValue(null)
    const moduleRef = await Test.createTestingModule({
        providers: [
            OpenApiToolsPinService,
            { provide: DataHubService, useValue: hub },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { hub, bindings, service: moduleRef.get(OpenApiToolsPinService) }
}

describe("OpenApiToolsPinService", () => {
    it("pins the document for the owner or a manager beside the connection's own facts, keeping its name and schedule", async () => {
        const { hub, service } = await build()

        const view = await service.pin(actor, DRAFT)
        const [, , change] = hub.update.mock.calls[0] ?? []

        expect(hub.ownerOrManager).toHaveBeenCalledWith(actor)
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "connection-1", "openapi")
        expect(change).toMatchObject({ name: "CRM", everyMinutes: 60, meta: { config: CONFIG, summary: "kept" } })
        expect(accountFactsOf(change?.meta ?? {})).toEqual({
            connector: CONNECTOR,
            swaggerUrl: SWAGGER_URL,
            workspaceHeader: "X-Workspace-Id",
            documentSha256: view.documentSha256,
            live: false,
            pinnedBy: "owner-1",
            pinnedAt: NOW.toISOString(),
        })
        expect(jsonTextOf(pinnedTextOf(change?.meta ?? {}) ?? "")).toEqual(DOCUMENT)
        expect(view).toMatchObject({ connector: CONNECTOR, swaggerUrl: SWAGGER_URL, live: false, pinnedAt: NOW.toISOString() })
        // The declared operations of the CRM, looked up by their one name; the operation no plugin declares is listed by the name it has.
        expect(view.tools.map((tool) => `${tool.state} ${tool.tool}`)).toEqual([
            "ready nivo.api.crm.acme.get.customers.code",
            "missing nivo.api.crm.acme.get.customers.code.balance",
        ])
        expect(view.undeclared).toEqual([{ toolId: "nivo.api.crm.acme.get.things", method: "GET", path: "/v1/things" }])
        expect(view.documentSha256).toMatch(/^[0-9a-f]{64}$/u)
        expect([...pinnedOpsOf(change?.meta ?? {})].toSorted()).toEqual(["nivo.api.crm.acme.get.customers.code", "nivo.api.crm.acme.get.things"])
    })

    it("refuses a connection whose key is not sent in a header, a connector that is no CRM provider key and an unreadable document, storing nothing", async () => {
        const query = await build({ config: JSON.stringify({ v: 1, baseUrl: "https://crm.example.test", authType: "query", authName: "key" }) })
        const { hub, service } = await build()

        await expect(query.service.pin(actor, DRAFT)).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: "key_not_in_header" } })
        await expect(service.pin(actor, { ...DRAFT, connector: "acme" })).rejects.toMatchObject({ params: { detail: "crm_id_invalid" } })
        await expect(service.pin(actor, { ...DRAFT, connector: "nivo-web" })).rejects.toMatchObject({ params: { detail: "crm_id_invalid" } })
        await expect(service.pin(actor, { ...DRAFT, workspaceHeader: "X Workspace" })).rejects.toMatchObject({ params: { detail: "workspace_header_invalid" } })
        await expect(service.pin(actor, { ...DRAFT, documentText: "swagger: 2" })).rejects.toMatchObject({ params: { detail: "not_json" } })
        expect(hub.update).not.toHaveBeenCalled()
        expect(query.hub.update).not.toHaveBeenCalled()
    })

    it("shows what a pinned connection serves and nothing for one that pinned no document", async () => {
        const pinned = await build()
        await pinned.service.pin(actor, { ...DRAFT, live: true })
        const stored = pinned.hub.update.mock.calls[0]?.[2].meta ?? {}

        const again = await build(stored)
        const empty = await build()

        await expect(again.service.view(actor, "connection-1")).resolves.toMatchObject({
            connector: CONNECTOR,
            swaggerUrl: SWAGGER_URL,
            undeclared: [{ toolId: "nivo.api.crm.acme.get.things", method: "GET", path: "/v1/things" }],
            workspaceHeader: "X-Workspace-Id",
            live: true,
            documentSha256: accountFactsOf(stored)?.documentSha256,
        })
        await expect(empty.service.view(actor, "connection-1")).resolves.toBeNull()
    })
})

describe("OpenApiToolsPinService: dry plan, repeat, own CRM and taken CRM ids", () => {
    it("plans a pin exactly as it would be written and writes nothing", async () => {
        const { hub, service } = await build()

        const plan = await service.plan(actor, DRAFT)

        expect(plan.changed).toBe(true)
        expect(plan.view).toMatchObject({ connector: CONNECTOR, workspaceHeader: "X-Workspace-Id", live: false, pinnedAt: NOW.toISOString() })
        expect(plan.view.documentSha256).toMatch(/^[0-9a-f]{64}$/u)
        expect(plan.view.audiences.map((audience) => audience.tool)).toEqual(plan.view.tools.map((tool) => tool.tool))
        expect(hub.ownerOrManager).toHaveBeenCalledWith(actor)
        expect(hub.update).not.toHaveBeenCalled()
    })

    it("pins once: the same document, CRM id, Swagger URL, header and live switch a second time writes nothing and keeps the first time", async () => {
        const first = await build()
        await first.service.pin(actor, DRAFT)
        const stored = first.hub.update.mock.calls[0]?.[2].meta ?? {}
        const pinnedAt = accountFactsOf(stored)?.pinnedAt

        const second = await build(stored)
        const plan = await second.service.plan(actor, DRAFT)
        const view = await second.service.pin(actor, DRAFT)

        expect(first.hub.update).toHaveBeenCalledTimes(1)
        expect(plan.changed).toBe(false)
        expect(view.pinnedAt).toBe(pinnedAt)
        expect(second.hub.update).not.toHaveBeenCalled()

        await second.service.pin(actor, { ...DRAFT, live: true })
        expect(second.hub.update).toHaveBeenCalledTimes(1)
        await second.service.pin(actor, { ...DRAFT, swaggerUrl: "https://crm.example.test/v2/openapi.json" })
        expect(second.hub.update).toHaveBeenCalledTimes(2)
    })

    it("pins a CRM id no installed package declares as the shop's own CRM: no declared tool is checked, every operation is listed under its name", async () => {
        const { hub, service } = await build()

        const view = await service.pin(actor, { ...DRAFT, connector: "crm.shopcrm" })

        expect(view).toMatchObject({ connector: "crm.shopcrm", tools: [], audiences: [] })
        expect(view.undeclared.map((operation) => operation.toolId)).toEqual([
            "nivo.api.crm.shopcrm.get.customers.code",
            "nivo.api.crm.shopcrm.get.things",
        ])
        expect(hub.update).toHaveBeenCalledTimes(1)
    })

})

describe("OpenApiToolsPinService: base path, odd names and taken CRM ids", () => {
    it("reads the base path from the document's first server: a document served under /v2 names no operation of the /v1 paths", async () => {
        const { hub, service } = await build()
        const moved = JSON.stringify({ ...DOCUMENT, servers: [{ url: "https://crm.example.test/v2" }] })

        const planned = await service.plan(actor, { ...DRAFT, documentText: moved })

        expect(planned.view.tools.map((tool) => tool.state)).toEqual(["missing", "missing"])
        expect(planned.view.undeclared).toEqual([])
        expect(hub.update).not.toHaveBeenCalled()
    })

    it("does not refuse a document with an operation whose name breaks the law: it is listed as an operation nothing can call", async () => {
        const { service } = await build()
        const odd = JSON.stringify({ ...DOCUMENT, paths: { ...DOCUMENT.paths, "/v1/2fa": { get: { responses: {} } } } })

        const view = await service.pin(actor, { ...DRAFT, documentText: odd })

        expect(view.undeclared.map((operation) => operation.toolId)).toContain("nivo.api.crm.acme.get.2fa")
        expect(view.tools[0]).toMatchObject({ tool: "nivo.api.crm.acme.get.customers.code", state: "ready" })
    })

    it("refuses a CRM id another open account of the workspace already serves, and not one a disconnected account held", async () => {
        const holder = await build()
        await holder.service.pin(actor, DRAFT)
        const held = holder.hub.update.mock.calls[0]?.[2].meta ?? {}
        const taken = await build()
        const freed = await build()
        const other = connectionRecordOf({ id: "connection-2", workspaceId: "workspace-1", meta: held })
        taken.bindings.ofProvider.mockResolvedValue([connectionStatusOf({ id: "connection-1" }), connectionStatusOf({ id: "connection-2" })])
        taken.bindings.recordOf.mockResolvedValue(other)
        freed.bindings.ofProvider.mockResolvedValue([connectionStatusOf({ id: "connection-2", status: "disconnected" })])
        freed.bindings.recordOf.mockResolvedValue(other)

        await expect(taken.service.plan(actor, DRAFT)).rejects.toMatchObject({ params: { detail: "connector_taken" } })
        await expect(taken.service.pin(actor, DRAFT)).rejects.toMatchObject({ params: { detail: "connector_taken" } })
        await expect(taken.service.pin(actor, { ...DRAFT, connector: "crm.shopcrm" })).resolves.toMatchObject({ connector: "crm.shopcrm" })
        await expect(freed.service.plan(actor, DRAFT)).resolves.toMatchObject({ changed: true })

        expect(taken.bindings.ofProvider).toHaveBeenCalledWith("workspace-1", "openapi", 20)
        expect(taken.bindings.recordOf).toHaveBeenCalledWith("workspace-1", "connection-2")
        expect(freed.bindings.recordOf).not.toHaveBeenCalled()
    })
})
