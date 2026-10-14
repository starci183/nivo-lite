import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ConnectionActor } from "@modules/domain/connections"
import { OPENAPI, PUBLIC_HOST, openApiFailure } from "@modules/integrations/data-sources"
import type {
    OpenApiClient,
    OpenApiConfig,
    OpenApiOperation,
    OpenApiSpec,
    PublicHostClient,
} from "@modules/integrations/data-sources"
import type { DataConnection } from "./data-hub.contracts"
import { DataHubService } from "./data-hub.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import type { OpenApiAuthDraft, OpenApiConnectionDraft, OpenApiOperationTest } from "./openapi-wizard.contracts"
import { OpenApiWizardService } from "./openapi-wizard.service"
import { OPENAPI_WIZARD_TEXT, apiSummary } from "./messages/openapi.messages"

describe("OpenApiWizardService", () => {
    const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "workspace-1" }
    const op: OpenApiOperation = {
        id: "list-customers",
        method: "GET",
        path: "/customers",
        summary: "List customers",
        params: [],
        hasBody: false,
    }
    const auth: OpenApiAuthDraft = { type: "bearer", name: "", value: "typed-token", user: "", password: "" }
    const config: OpenApiConfig = {
        v: 1,
        specUrl: "https://api.example.com/spec.json",
        baseUrl: "https://api.example.com",
        authType: "bearer",
        authName: "",
        ops: [op],
        pulls: [
            {
                opId: op.id,
                entity: "customer",
                itemsPath: "data.items",
                idField: "id",
                titleField: "name",
                fixedQuery: "limit=2",
            },
        ],
        tools: [op.id],
    }
    const spec: OpenApiSpec = {
        title: "Customer API",
        baseUrl: config.baseUrl,
        ops: [op],
        authHint: { type: "bearer", name: "" },
    }
    const draft: OpenApiConnectionDraft = { name: " Customer API ", config, auth, syncEveryMinutes: 60 }
    const operationTest: OpenApiOperationTest = {
        baseUrl: " https://api.example.com/ ",
        op,
        auth,
        fixedQuery: "?limit=2",
        itemsPath: " data.items ",
    }
    const connection: DataConnection = {
        id: "api-1",
        workspaceId: "workspace-1",
        provider: "openapi",
        name: "Saved API",
        status: "connected",
        lastError: null,
        meta: { config: JSON.stringify(config) },
        everyMinutes: 15,
        lastSyncAt: null,
    }
    const savedCredential = '{"type":"bearer","name":"","value":"stored-token","user":"stored-user","password":""}'
    const build = async () => {
        const client = mock<OpenApiClient>()
        const publicHost = mock<PublicHostClient>()
        const hub = mock<DataHubService>()
        hub.own.mockResolvedValue(connection)
        hub.credentialOf.mockResolvedValue(savedCredential)
        hub.create.mockResolvedValue("api-new")
        client.parseSpec.mockReturnValue(spec)
        client.call.mockResolvedValue({
            status: 200,
            headers: {},
            text: '{"data":{"items":[{"id":"customer-1","name":"Ada"},{"id":"customer-2","name":"Lin"}]}}',
        })
        publicHost.resolve.mockResolvedValue({ address: "93.184.216.34", family: 4 })
        const moduleRef = await Test.createTestingModule({
            providers: [
                OpenApiWizardService,
                { provide: OPENAPI, useValue: client },
                { provide: PUBLIC_HOST, useValue: publicHost },
                { provide: DataHubService, useValue: hub },
            ],
        }).compile()
        return { service: moduleRef.get(OpenApiWizardService), client, publicHost, hub }
    }

    it("downloads and parses a spec when pasted text is blank", async () => {
        const { service, client, hub } = await build()
        client.fetchSpec.mockResolvedValue("downloaded-spec")

        await expect(
            service.loadSpec(actor, { specUrl: " https://api.example.com/spec.json ", specText: " " }),
        ).resolves.toEqual({ ...spec, specUrl: "https://api.example.com/spec.json" })
        expect(hub.owner).toHaveBeenCalledWith(actor)
        expect(client.fetchSpec).toHaveBeenCalledWith("https://api.example.com/spec.json")
        expect(client.parseSpec).toHaveBeenCalledWith("downloaded-spec", "https://api.example.com/spec.json")
    })

    it("uses pasted text ahead of the spec link", async () => {
        const { service, client } = await build()

        await expect(service.loadSpec(actor, { specUrl: "", specText: "pasted-spec" })).resolves.toEqual({
            ...spec,
            specUrl: "",
        })
        expect(client.parseSpec).toHaveBeenCalledWith("pasted-spec", "")
        expect(client.fetchSpec).not.toHaveBeenCalled()
    })

    it("refuses an empty spec source", async () => {
        const { service, client } = await build()

        await expect(service.loadSpec(actor, { specUrl: " ", specText: " " })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.noSpecInput },
        })
        expect(client.fetchSpec).not.toHaveBeenCalled()
    })

    it("refuses pasted specs larger than the limit", async () => {
        const { service, client } = await build()

        await expect(service.loadSpec(actor, { specUrl: "", specText: "x".repeat(5_000_001) })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.specTooLarge },
        })
        expect(client.parseSpec).not.toHaveBeenCalled()
    })

    it("returns the detected fields at the typed items path", async () => {
        const { service, client } = await build()

        await expect(service.testOperation(actor, operationTest)).resolves.toEqual({
            status: 200,
            itemCount: 2,
            itemsPath: "data.items",
            idField: "id",
            titleField: "name",
            sampleKeys: ["id", "name"],
            error: null,
        })
        expect(client.call).toHaveBeenCalledWith({
            baseUrl: "https://api.example.com",
            op,
            auth,
            input: {},
            fixedQuery: "limit=2",
        })
    })

    it("falls back to detected arrays and stored secrets when editing a connection", async () => {
        const { service, client, hub } = await build()
        client.call.mockResolvedValue({ status: 200, headers: {}, text: '{"results":[{"code":"a","title":"First"}]}' })

        await expect(
            service.testOperation(actor, {
                ...operationTest,
                connectionId: "api-1",
                auth: { ...auth, value: "" },
                itemsPath: "missing",
            }),
        ).resolves.toEqual({
            status: 200,
            itemCount: 1,
            itemsPath: "results",
            idField: "code",
            titleField: "title",
            sampleKeys: ["code", "title"],
            error: null,
        })
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "api-1", "openapi")
        expect(client.call).toHaveBeenCalledWith({
            baseUrl: "https://api.example.com",
            op,
            auth: { ...auth, value: "stored-token", user: "stored-user" },
            input: {},
            fixedQuery: "limit=2",
        })
    })

    it("treats an object response as one item and clips fixed query input", async () => {
        const { service, client } = await build()
        client.call.mockResolvedValue({ status: 201, headers: {}, text: '{"id":"one","name":"Single"}' })

        await expect(
            service.testOperation(actor, { ...operationTest, fixedQuery: "x".repeat(501), itemsPath: "" }),
        ).resolves.toEqual({
            status: 201,
            itemCount: 1,
            itemsPath: "",
            idField: "id",
            titleField: "name",
            sampleKeys: ["id", "name"],
            error: null,
        })
        expect(client.call).toHaveBeenCalledWith({
            baseUrl: "https://api.example.com",
            op,
            auth,
            input: {},
            fixedQuery: "x".repeat(500),
        })
    })

    it("returns empty field suggestions for an array without objects", async () => {
        const { service, client } = await build()
        client.call.mockResolvedValue({ status: 200, headers: {}, text: '["one",2]' })

        await expect(service.testOperation(actor, { ...operationTest, itemsPath: "" })).resolves.toEqual({
            status: 200,
            itemCount: 2,
            itemsPath: "",
            idField: "",
            titleField: "",
            sampleKeys: [],
            error: null,
        })
    })

    it("reports a failed HTTP status without reading the response body", async () => {
        const { service, client } = await build()
        client.call.mockResolvedValue({ status: 503, headers: {}, text: "service unavailable" })

        await expect(service.testOperation(actor, operationTest)).resolves.toEqual({
            status: 503,
            itemCount: 0,
            itemsPath: "",
            idField: "",
            titleField: "",
            sampleKeys: [],
            error: openApiFailure(503),
        })
    })

    it("reports a successful response that is not JSON", async () => {
        const { service, client } = await build()
        client.call.mockResolvedValue({ status: 200, headers: {}, text: "<html>OK</html>" })

        await expect(service.testOperation(actor, operationTest)).resolves.toEqual({
            status: 200,
            itemCount: 0,
            itemsPath: "",
            idField: "",
            titleField: "",
            sampleKeys: [],
            error: "API kh\u00f4ng tr\u1ea3 v\u1ec1 JSON, n\u00ean NIVO ch\u01b0a \u0111\u1ecdc \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u.",
        })
    })

    it("refuses to test a non-GET operation", async () => {
        const { service, client } = await build()

        await expect(
            service.testOperation(actor, { ...operationTest, op: { ...op, method: "POST" } }),
        ).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.getOnly },
        })
        expect(client.call).not.toHaveBeenCalled()
    })

    it("loads public config and secret presence without exposing the credential", async () => {
        const { service, hub } = await build()

        await expect(service.load(actor, "api-1")).resolves.toEqual({
            name: "Saved API",
            config,
            syncEveryMinutes: 15,
            hasSecret: true,
            authUser: "stored-user",
        })
        expect(hub.own).toHaveBeenCalledWith("workspace-1", "api-1", "openapi")
    })

    it("loads no secret when the credential is missing", async () => {
        const { service, hub } = await build()
        hub.credentialOf.mockResolvedValue(null)

        await expect(service.load(actor, "api-1")).resolves.toEqual({
            name: "Saved API",
            config,
            syncEveryMinutes: 15,
            hasSecret: false,
            authUser: "",
        })
    })

    it("refuses to load a connection without usable configuration", async () => {
        const { service, hub } = await build()
        hub.own.mockResolvedValue({ ...connection, meta: {} })

        await expect(service.load(actor, "api-1")).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.notConfigured },
        })
    })

    it("creates a connection with public config and the separate credential", async () => {
        const { service, hub, publicHost } = await build()

        await expect(service.save(actor, draft)).resolves.toBe("api-new")
        expect(publicHost.resolve).toHaveBeenCalledWith("api.example.com")
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "openapi",
            name: "Customer API",
            meta: { config: JSON.stringify(config), summary: apiSummary(1, 1) },
            credential: '{"type":"bearer","name":"","value":"typed-token","user":"","password":""}',
            everyMinutes: 60,
        })
    })

    it("updates an owned connection and keeps the stored token", async () => {
        const { service, hub } = await build()

        await expect(
            service.save(actor, { ...draft, connectionId: "api-1", auth: { ...auth, value: "" } }),
        ).resolves.toBe("api-1")
        expect(hub.saveCredential).toHaveBeenCalledWith(
            "api-1",
            '{"type":"bearer","name":"","value":"stored-token","user":"stored-user","password":""}',
        )
        expect(hub.update).toHaveBeenCalledWith("workspace-1", "api-1", {
            name: "Customer API",
            meta: { config: JSON.stringify(config), summary: apiSummary(1, 1) },
            everyMinutes: 60,
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("creates a manual connection without auth when its configuration requests none", async () => {
        const { service, hub } = await build()
        const manualConfig: OpenApiConfig = { ...config, authType: "none", pulls: [] }

        await expect(
            service.save(actor, {
                ...draft,
                connectionId: null,
                config: manualConfig,
                auth: { ...auth, type: "none", value: "" },
                syncEveryMinutes: undefined,
            }),
        ).resolves.toBe("api-new")
        expect(hub.create).toHaveBeenCalledWith(actor, {
            provider: "openapi",
            name: "Customer API",
            meta: { config: JSON.stringify(manualConfig), summary: apiSummary(0, 1) },
            credential: '{"type":"none","name":"","value":"","user":"","password":""}',
            everyMinutes: null,
        })
    })

    it.each([
        { name: " ", syncEveryMinutes: 60, detail: OPENAPI_WIZARD_TEXT.nameRequired },
        { name: "Customer API", syncEveryMinutes: 30, detail: OPENAPI_WIZARD_TEXT.badSchedule },
    ])("refuses invalid name or schedule: $detail", async ({ name, syncEveryMinutes, detail }) => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...draft, name, syncEveryMinutes })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail },
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("refuses a base URL without an HTTP scheme", async () => {
        const { service, publicHost } = await build()

        await expect(
            service.save(actor, { ...draft, config: { ...config, baseUrl: "ftp://api.example.com" } }),
        ).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.baseUrlScheme },
        })
        expect(publicHost.resolve).not.toHaveBeenCalled()
    })

    it("refuses a configuration with no selected operation", async () => {
        const { service, hub } = await build()

        await expect(
            service.save(actor, { ...draft, config: { ...config, pulls: [], tools: [] } }),
        ).rejects.toMatchObject({ code: DataHubErrorCode.Invalid, params: { detail: OPENAPI_WIZARD_TEXT.pickOne } })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("refuses missing auth when the configured API needs it", async () => {
        const { service, hub } = await build()

        await expect(service.save(actor, { ...draft, auth: { ...auth, value: "" } })).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.authRequired },
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it.each(["header", "query"])("refuses %s authentication without its parameter name", async (type) => {
        const { service, hub } = await build()

        await expect(
            service.save(actor, { ...draft, config: { ...config, authType: type }, auth: { ...auth, type } }),
        ).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.authNameRequired },
        })
        expect(hub.create).not.toHaveBeenCalled()
    })

    it("keeps a host refusal visible before creating the connection", async () => {
        const { service, hub, publicHost } = await build()
        const refusal = new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail: "Host refused" } })
        publicHost.resolve.mockRejectedValue(refusal)

        await expect(service.save(actor, draft)).rejects.toBe(refusal)
        expect(hub.create).not.toHaveBeenCalled()
    })
})
