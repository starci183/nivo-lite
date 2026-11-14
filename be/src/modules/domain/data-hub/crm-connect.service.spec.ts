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
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { DOCUMENT_MAX_CHARS } from "@modules/domain/openapi-tools"
import {
    DataSourcesError,
    DataSourcesErrorCode,
    OPENAPI,
    PUBLIC_HOST,
    type OpenApiClient,
    type PublicHostClient,
} from "@modules/integrations/data-sources"
import { CLOCK } from "@modules/platform/clock"
import { CrmConnectService, type CrmConnectionDraft } from "./crm-connect.service"
import type { DataConnection } from "./data-hub.contracts"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { OpenApiToolsPinService } from "./openapi-tools-pin.service"

const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }
const NOW = new Date("2026-11-14T08:00:00.000Z")
const SECRET = "s3cret-key"
const CONNECTION_ID = "connection-new"

/** The CRM fixture plugin declares `acme` (bearer, `/openapi.json`) and calls two operations of it; this document serves only the first. */
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

/** The same document serving both operations the plugin calls. */
const COMPLETE_DOCUMENT = {
    ...DOCUMENT,
    paths: {
        ...DOCUMENT.paths,
        "/v1/customers/{code}/balance": {
            get: {
                parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
                responses: {},
            },
        },
    },
}

const TEMPLATE_DRAFT: CrmConnectionDraft = {
    crmId: "acme",
    baseUrl: "https://crm.example.test/",
    auth: { type: "bearer", value: SECRET },
}

const OWN_DRAFT: CrmConnectionDraft = {
    crmId: "shopcrm",
    baseUrl: "https://crm.shop.test",
    swaggerUrl: "https://crm.shop.test/docs/openapi.json",
    auth: { type: "header", name: "X-Shop-Key", value: SECRET },
}

/** What the stand-in hub keeps of the one connection the service writes. */
interface StoredConnection {
    connection: DataConnection | null
    credential: string | null
}

/** A stored credential read back: a text that is no JSON comes back as its parse failure, which fails the match that reads it. */
const credentialOf = (text: string | null | undefined): unknown => {
    try {
        return JSON.parse(text ?? "{}")
    } catch (cause) {
        return cause
    }
}

const build = async (document: unknown = DOCUMENT) => {
    const enterprise = mock<WorkspaceEnterpriseService>()
    enterprise.keyOf.mockResolvedValue(null)
    const hub = mock<DataHubService>()
    const bindings = mock<ConnectionBindingsReadService>()
    const client = mock<OpenApiClient>()
    const publicHost = mock<PublicHostClient>()
    // A small stateful stand-in for the one connection the service writes, so a second save and a view read what the first stored.
    const stored: StoredConnection = { connection: null, credential: null }
    hub.ownerOrManager.mockResolvedValue({ role: "owner", displayName: "Owner" })
    hub.create.mockImplementation((_actor, draft) => {
        stored.connection = {
            id: CONNECTION_ID,
            workspaceId: actor.workspaceId,
            provider: "openapi",
            name: draft.name,
            status: "connected",
            lastError: null,
            meta: draft.meta,
            everyMinutes: draft.everyMinutes,
            lastSyncAt: null,
        }
        stored.credential = draft.credential ?? null
        return Promise.resolve(CONNECTION_ID)
    })
    hub.own.mockImplementation((_workspaceId, id) => {
        if (stored.connection === null || stored.connection.id !== id) return Promise.reject(new DataHubError({ code: DataHubErrorCode.NotFound }))
        return Promise.resolve(stored.connection)
    })
    hub.update.mockImplementation((_workspaceId, _id, change) => {
        if (stored.connection !== null) stored.connection = { ...stored.connection, ...change }
        return Promise.resolve()
    })
    hub.saveCredential.mockImplementation((_id, credential) => {
        stored.credential = credential
        return Promise.resolve()
    })
    hub.credentialOf.mockImplementation(() => Promise.resolve(stored.credential))
    bindings.ofProvider.mockResolvedValue([])
    bindings.recordOf.mockResolvedValue(null)
    publicHost.allowsPrivate.mockReturnValue(false)
    publicHost.resolve.mockResolvedValue({ address: "93.184.216.34", family: 4 })
    client.fetchSpec.mockResolvedValue(JSON.stringify(document))
    const moduleRef = await Test.createTestingModule({
        providers: [
            CrmConnectService,
            OpenApiToolsPinService,
            { provide: DataHubService, useValue: hub },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: OPENAPI, useValue: client },
            { provide: PUBLIC_HOST, useValue: publicHost },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceEnterpriseService, useValue: enterprise },
        ],
    }).compile()
    return {
        hub,
        client,
        publicHost,
        stored,
        service: moduleRef.get(CrmConnectService),
        pins: moduleRef.get(OpenApiToolsPinService),
    }
}

describe("CrmConnectService templates", () => {
    it("lists the CRMs the installed packages declare, with how many operations they call", async () => {
        const { service } = await build()

        expect(await service.templates(actor.workspaceId)).toEqual([
            {
                id: "acme",
                label: { vi: "CRM", en: "CRM" },
                authType: "bearer",
                authName: "",
                swaggerPath: "/openapi.json",
                baseUrlHint: "https://crm.example.test",
                docs: "",
                neededCount: 2,
            },
        ])
    })
})

describe("CrmConnectService save: a CRM a package declares", () => {
    it("fetches the live document at base URL + swagger path, seals the key, pins it and reports the operation the document lacks", async () => {
        const { service, hub, client } = await build()

        const result = await service.save(actor, TEMPLATE_DRAFT)

        expect(hub.ownerOrManager).toHaveBeenCalledWith(actor)
        expect(client.fetchSpec).toHaveBeenCalledWith("https://crm.example.test/openapi.json")
        const [, created] = hub.create.mock.calls[0] ?? []
        expect(created).toMatchObject({ provider: "openapi", meta: { summary: "acme" } })
        expect(credentialOf(created?.credential)).toMatchObject({ type: "bearer", value: SECRET })
        expect(result).toMatchObject({ connectionId: CONNECTION_ID, templated: true, compatible: false, driftFromTemplate: [] })
        expect(result.pin).toMatchObject({
            connector: "crm.acme",
            swaggerUrl: "https://crm.example.test/openapi.json",
            live: false,
            pinnedAt: NOW.toISOString(),
        })
        // The operation the packages call and the live document lacks is saved and named `missing`; nothing is refused.
        expect(result.pin.tools.map((tool) => `${tool.state} ${tool.tool}`)).toEqual([
            "ready nivo.api.crm.acme.get.customers.code",
            "missing nivo.api.crm.acme.get.customers.code.balance",
        ])
        expect(result.pin.undeclared.map((operation) => operation.toolId)).toEqual(["nivo.api.crm.acme.get.things"])
        expect(JSON.stringify(result)).not.toContain(SECRET)
    })

    it("is compatible when the live document serves every operation the packages call", async () => {
        const { service } = await build(COMPLETE_DOCUMENT)

        const result = await service.save(actor, TEMPLATE_DRAFT)

        expect(result.compatible).toBe(true)
        expect(result.pin.tools.every((tool) => tool.state === "ready")).toBe(true)
    })

    it("refuses a key sent another way than the template says, before fetching anything", async () => {
        const { service, client, hub } = await build()

        await expect(
            service.save(actor, { ...TEMPLATE_DRAFT, auth: { type: "header", name: "X-Key", value: SECRET } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: "auth_type_mismatch" } })

        expect(client.fetchSpec).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("ignores a Swagger URL typed for a template's CRM: the template says where the document is", async () => {
        const { service, client } = await build(COMPLETE_DOCUMENT)

        await service.save(actor, { ...TEMPLATE_DRAFT, swaggerUrl: "https://elsewhere.example.test/x.json" })

        expect(client.fetchSpec).toHaveBeenCalledWith("https://crm.example.test/openapi.json")
    })
})

describe("CrmConnectService save: the shop's own CRM", () => {
    it("asks for the Swagger URL when no package declares the CRM", async () => {
        const { service, client } = await build()

        await expect(service.save(actor, { ...OWN_DRAFT, swaggerUrl: "  " })).rejects.toMatchObject({
            params: { detail: "swagger_url_required" },
        })
        await expect(service.save(actor, { ...OWN_DRAFT, swaggerUrl: null })).rejects.toMatchObject({
            params: { detail: "swagger_url_required" },
        })

        expect(client.fetchSpec).not.toHaveBeenCalled()
    })

    it("pins the document under its own id: no operation is checked, every one is listed by its name", async () => {
        const { service, client } = await build()

        const result = await service.save(actor, OWN_DRAFT)

        expect(client.fetchSpec).toHaveBeenCalledWith("https://crm.shop.test/docs/openapi.json")
        expect(result).toMatchObject({ templated: false, compatible: true, driftFromTemplate: [] })
        expect(result.pin).toMatchObject({ connector: "crm.shopcrm", tools: [] })
        expect(result.pin.undeclared.map((operation) => operation.toolId)).toEqual([
            "nivo.api.crm.shopcrm.get.customers.code",
            "nivo.api.crm.shopcrm.get.things",
        ])
    })

    it.each(["A", "x", "1crm", "has space", "a".repeat(40)])("refuses the CRM id %p", async (crmId) => {
        const { service } = await build()

        await expect(service.save(actor, { ...OWN_DRAFT, crmId })).rejects.toMatchObject({
            params: { detail: "crm_id_invalid" },
        })
    })
})

describe("CrmConnectService save: addresses, the key and the document", () => {
    it.each([
        ["http://crm.shop.test", "https_required"],
        ["not a url", "not_a_url"],
        ["https://192.168.0.5", "private_host"],
        ["http://localhost:8080", "private_host"],
    ])("refuses the base URL %s (%s)", async (baseUrl, detail) => {
        const { service, client } = await build()

        await expect(service.save(actor, { ...OWN_DRAFT, baseUrl })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })

        expect(client.fetchSpec).not.toHaveBeenCalled()
    })

    it("refuses a host that resolves into a private network, and a Swagger URL on a plain http address", async () => {
        const { service, publicHost, client } = await build()
        publicHost.resolve.mockRejectedValueOnce(new DataSourcesError({ code: DataSourcesErrorCode.HostPrivate }))

        await expect(service.save(actor, OWN_DRAFT)).rejects.toMatchObject({ params: { detail: "private_host" } })
        await expect(
            service.save(actor, { ...OWN_DRAFT, swaggerUrl: "http://crm.shop.test/openapi.json" }),
        ).rejects.toMatchObject({ params: { detail: "https_required" } })

        expect(client.fetchSpec).not.toHaveBeenCalled()
    })

    it("refuses a Swagger document that cannot be fetched, is too large or is no OpenAPI 3 JSON", async () => {
        const { service, client, hub } = await build()
        client.fetchSpec.mockRejectedValueOnce(new DataSourcesError({ code: DataSourcesErrorCode.Unavailable }))
        await expect(service.save(actor, OWN_DRAFT)).rejects.toMatchObject({ params: { detail: "swagger_unreachable" } })

        client.fetchSpec.mockResolvedValueOnce("x".repeat(DOCUMENT_MAX_CHARS + 1))
        await expect(service.save(actor, OWN_DRAFT)).rejects.toMatchObject({ params: { detail: "too_large" } })

        client.fetchSpec.mockResolvedValueOnce("swagger: 2")
        await expect(service.save(actor, OWN_DRAFT)).rejects.toMatchObject({ params: { detail: "not_json" } })

        client.fetchSpec.mockResolvedValueOnce(JSON.stringify({ swagger: "2.0", paths: {} }))
        await expect(service.save(actor, OWN_DRAFT)).rejects.toMatchObject({ params: { detail: "swagger_2" } })

        expect(hub.create).not.toHaveBeenCalled()
    })

    it("refuses a new connection that comes with no key", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...TEMPLATE_DRAFT, auth: { type: "bearer", value: "" } })).rejects.toMatchObject({
            params: { detail: "auth_required" },
        })

        expect(hub.create).not.toHaveBeenCalled()
    })
})

describe("CrmConnectService save: updating and who may", () => {
    it("keeps the stored key on a blank value and keeps the live switch, fetching the document again", async () => {
        const { service, pins, client, hub, stored } = await build(COMPLETE_DOCUMENT)
        await service.save(actor, TEMPLATE_DRAFT)
        // Real writes are a person's switch, set apart from the connect wizard.
        await pins.pin(actor, {
            connectionId: CONNECTION_ID,
            connector: "crm.acme",
            swaggerUrl: "https://crm.example.test/openapi.json",
            workspaceHeader: "X-Workspace-Id",
            documentText: JSON.stringify(COMPLETE_DOCUMENT),
            live: true,
        })
        client.fetchSpec.mockClear()

        const result = await service.save(actor, {
            ...TEMPLATE_DRAFT,
            connectionId: CONNECTION_ID,
            auth: { type: "bearer", value: "" },
        })

        expect(client.fetchSpec).toHaveBeenCalledTimes(1)
        expect(hub.create).toHaveBeenCalledTimes(1)
        expect(credentialOf(stored.credential)).toMatchObject({ value: SECRET })
        expect(result.connectionId).toBe(CONNECTION_ID)
        expect(result.pin.live).toBe(true)
    })

    it("replaces the stored key when a new one is typed", async () => {
        const { service, stored } = await build(COMPLETE_DOCUMENT)
        await service.save(actor, TEMPLATE_DRAFT)

        await service.save(actor, { ...TEMPLATE_DRAFT, connectionId: CONNECTION_ID, auth: { type: "bearer", value: "next-key" } })

        expect(credentialOf(stored.credential)).toMatchObject({ value: "next-key" })
    })

    it("lets a manager connect a CRM", async () => {
        const { service, hub } = await build(COMPLETE_DOCUMENT)
        hub.ownerOrManager.mockResolvedValue({ role: "manager", displayName: "Manager" })

        await expect(service.save({ ...actor, principalId: "manager-1" }, TEMPLATE_DRAFT)).resolves.toMatchObject({
            connectionId: CONNECTION_ID,
        })
    })

    it("refuses a member before fetching, sealing or saving anything", async () => {
        const { service, hub, client, publicHost } = await build()
        hub.ownerOrManager.mockRejectedValue(new Error("members may not connect a CRM"))

        await expect(service.save({ ...actor, principalId: "member-1" }, TEMPLATE_DRAFT)).rejects.toThrow(
            "members may not connect a CRM",
        )
        await expect(service.connection({ ...actor, principalId: "member-1" }, CONNECTION_ID)).rejects.toThrow(
            "members may not connect a CRM",
        )

        expect(publicHost.resolve).not.toHaveBeenCalled()
        expect(client.fetchSpec).not.toHaveBeenCalled()
        expect(hub.create).not.toHaveBeenCalled()
    })
})

describe("CrmConnectService connection", () => {
    it("reopens a saved connection with its address, how its key is sent, whether one is stored and its pin, never the key", async () => {
        const { service } = await build()
        await service.save(actor, TEMPLATE_DRAFT)

        const view = await service.connection(actor, CONNECTION_ID)

        expect(view).toMatchObject({
            crmId: "acme",
            baseUrl: "https://crm.example.test",
            swaggerUrl: "https://crm.example.test/openapi.json",
            authType: "bearer",
            authName: "",
            hasSecret: true,
        })
        expect(view.pin?.connector).toBe("crm.acme")
        expect(JSON.stringify(view)).not.toContain(SECRET)
    })

    it("names the header of a key sent in a header, and reports no key once none is stored", async () => {
        const { service, stored } = await build()
        await service.save(actor, OWN_DRAFT)
        stored.credential = null

        const view = await service.connection(actor, CONNECTION_ID)

        expect(view).toMatchObject({ crmId: "shopcrm", authType: "header", authName: "X-Shop-Key", hasSecret: false })
    })
})
