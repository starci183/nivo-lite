import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { DataSourcesError, DataSourcesErrorCode, OPENAPI, openApiFailure } from "@modules/integrations/data-sources"
import type { OpenApiClient, OpenApiConfig, OpenApiOperation, OpenApiPull } from "@modules/integrations/data-sources"
import type { DataConnection, DataSyncContext } from "./data-hub.contracts"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { OPENAPI_WIZARD_TEXT } from "./messages/openapi.messages"
import { OpenApiSyncService } from "./openapi-sync.service"

const operation = builder<OpenApiOperation>({
    id: "customers",
    method: "GET",
    path: "/customers",
    summary: "Customers",
    params: [],
    hasBody: false,
})
const pull = builder<OpenApiPull>({
    opId: "customers",
    entity: "customer",
    itemsPath: "items",
    idField: "id",
    titleField: "name",
    fixedQuery: "active=true",
})
const config = builder<OpenApiConfig>({
    v: 1,
    specUrl: "https://owner.example/openapi.json",
    baseUrl: "https://owner.example/api",
    authType: "bearer",
    authName: "",
    ops: [operation()],
    pulls: [pull()],
    tools: [],
})
const connection = builder<DataConnection>({
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    provider: "openapi",
    name: "Owner API",
    status: "connected",
    lastError: null,
    meta: {},
    everyMinutes: null,
    lastSyncAt: null,
})
const auth = { type: "bearer", name: "", value: "owner-token", user: "", password: "" }

const build = async (savedConfig: OpenApiConfig = config(), meta: Readonly<Record<string, string>> = {}) => {
    const client = mock<OpenApiClient>()
    const context = mock<DataSyncContext>({
        connection: connection({ meta: { config: JSON.stringify(savedConfig), ...meta } }),
        credential: JSON.stringify(auth),
    })
    context.isExpired.mockReturnValue(false)
    context.upsert.mockImplementation((_entity, rows) => Promise.resolve(rows.length))
    const moduleRef = await Test.createTestingModule({
        providers: [OpenApiSyncService, { provide: OPENAPI, useValue: client }],
    }).compile()
    return { service: moduleRef.get(OpenApiSyncService), client, context }
}

describe("OpenApiSyncService", () => {
    it("identifies its provider and rejects absent or malformed configuration", async () => {
        const { service, client, context } = await build()
        expect(service.provider).toBe("openapi")
        for (const raw of ["", "broken", "null"]) {
            const invalidContext = { ...context, connection: connection({ meta: { config: raw } }) }
            await expect(service.sync(invalidContext)).rejects.toMatchObject({
                code: DataHubErrorCode.Invalid,
                params: { detail: OPENAPI_WIZARD_TEXT.syncNotConfigured },
            })
        }
        expect(client.call).not.toHaveBeenCalled()
    })

    it("rejects a configuration without any pulls", async () => {
        const { service, client, context } = await build(config({ pulls: [] }))
        await expect(service.sync(context)).rejects.toMatchObject({
            code: DataHubErrorCode.Invalid,
            params: { detail: OPENAPI_WIZARD_TEXT.syncNoPulls },
        })
        expect(client.call).not.toHaveBeenCalled()
    })

    it("writes the last occurrence of each id and sends the configured credential and query", async () => {
        const { service, client, context } = await build()
        context.upsert.mockResolvedValue(1)
        client.call.mockResolvedValue({
            status: 200,
            headers: {},
            text: JSON.stringify({
                items: [
                    { id: "c1", name: "Old" },
                    { id: "c1", name: "Current", updated_at: "2026-10-01T00:00:00.000Z" },
                    { id: "c2", name: "Second" },
                ],
            }),
        })
        await expect(service.sync(context)).resolves.toEqual({ rows: 1, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenCalledWith({
            baseUrl: "https://owner.example/api",
            op: operation(),
            auth,
            input: {},
            fixedQuery: "active=true",
        })
        expect(context.upsert).toHaveBeenCalledWith("customer", [
            {
                externalId: "c1",
                title: "Current",
                occurredAt: "2026-10-01T00:00:00.000Z",
                data: { id: "c1", name: "Current", updated_at: "2026-10-01T00:00:00.000Z" },
            },
            { externalId: "c2", title: "Second", occurredAt: null, data: { id: "c2", name: "Second" } },
        ])
    })

    it("finishes an empty page without writing rows", async () => {
        const { service, client, context } = await build()
        client.call.mockResolvedValue({ status: 200, headers: {}, text: '{"items":[]}' })
        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: { "cursor.customers": "" } })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("follows same-origin next links and stops on an empty answer", async () => {
        const { service, client, context } = await build()
        client.call.mockResolvedValueOnce({
            status: 200,
            headers: {},
            text: '{"items":[{"id":"c1"}],"next":"https://owner.example/api/customers?page=2"}',
        })
        client.call.mockResolvedValueOnce({ status: 200, headers: {}, text: '{"items":[]}' })
        await expect(service.sync(context)).resolves.toEqual({ rows: 1, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenNthCalledWith(2, {
            baseUrl: "https://owner.example/api",
            op: operation(),
            auth,
            input: {},
            fixedQuery: "active=true",
            link: "https://owner.example/api/customers?page=2",
        })
    })

    it("does not follow cross-origin or repeated next links", async () => {
        const saved = JSON.stringify({ page: 2, link: "https://owner.example/api/customers?page=3" })
        const { service, client, context } = await build(config(), { "cursor.customers": saved })
        client.call.mockResolvedValueOnce({
            status: 200,
            headers: {},
            text: '{"items":[{"id":"c1"}],"next":"https://owner.example/api/customers?page=3"}',
        })
        await expect(service.sync(context)).resolves.toEqual({ rows: 1, meta: { "cursor.customers": "" } })
        client.call.mockResolvedValueOnce({
            status: 200,
            headers: {},
            text: '{"items":[{"id":"c2"}],"next":"https://other.example/customers"}',
        })
        await expect(service.sync(context)).resolves.toEqual({ rows: 1, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenCalledTimes(2)
    })

    it("discards unsafe stored links while resuming the saved page number", async () => {
        const paged = operation({ params: [{ name: "page", in: "query", required: false }] })
        const { service, client, context } = await build(config({ ops: [paged] }), {
            "cursor.customers": JSON.stringify({ page: 3, link: "https://other.example/customers" }),
        })
        client.call.mockResolvedValue({ status: 200, headers: {}, text: '{"items":[]}' })
        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenCalledWith({
            baseUrl: "https://owner.example/api",
            op: paged,
            auth,
            input: { page: 4 },
            fixedQuery: "active=true",
        })
    })

    it("saves the next link when the time budget expires between pages", async () => {
        const { service, client, context } = await build()
        context.isExpired.mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValue(true)
        client.call.mockResolvedValue({
            status: 200,
            headers: {},
            text: '{"items":[{"id":"c1"}],"next":"https://owner.example/api/customers?page=2"}',
        })
        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            meta: { "cursor.customers": '{"page":1,"link":"https://owner.example/api/customers?page=2"}' },
        })
        expect(client.call).toHaveBeenCalledTimes(1)
    })

    it("discards a malformed stored link while preserving the saved page", async () => {
        const paged = operation({ params: [{ name: "page", in: "query", required: false }] })
        const { service, client, context } = await build(config({ ops: [paged] }), {
            "cursor.customers": JSON.stringify({ page: 3, link: "://broken" }),
        })
        client.call.mockResolvedValue({ status: 200, headers: {}, text: '{"items":[]}' })
        await expect(service.sync(context)).resolves.toEqual({ rows: 0, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenCalledWith({
            baseUrl: "https://owner.example/api",
            op: paged,
            auth,
            input: { page: 4 },
            fixedQuery: "active=true",
        })
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("reports unstarted operations when the time budget has already expired", async () => {
        const { service, client, context } = await build()
        context.isExpired.mockReturnValue(true)
        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            meta: {},
            note: OPENAPI_WIZARD_TEXT.syncUnfinished,
        })
        expect(client.call).not.toHaveBeenCalled()
    })

    it("saves an unstarted page when the time budget expires after the operation begins", async () => {
        const { service, client, context } = await build()
        context.isExpired.mockReturnValueOnce(false).mockReturnValue(true)
        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            meta: { "cursor.customers": '{"page":0,"link":""}' },
        })
        expect(client.call).not.toHaveBeenCalled()
    })

    it("stops when an API ignores page parameters and repeats the first item", async () => {
        const paged = operation({ params: [{ name: "page", in: "query", required: false }] })
        const { service, client, context } = await build(config({ ops: [paged] }))
        const items = Array.from({ length: 10 }, (_unused, index) => ({ id: `c${index}` }))
        client.call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify({ items }) })
        await expect(service.sync(context)).resolves.toEqual({ rows: 10, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenCalledTimes(2)
        expect(context.upsert).toHaveBeenCalledTimes(1)
    })

    it("finishes a short limit page and includes the page size in the request", async () => {
        const paged = operation({
            params: [
                { name: "pageIndex", in: "query", required: false },
                { name: "limit", in: "query", required: false },
            ],
        })
        const { service, client, context } = await build(config({ ops: [paged] }))
        client.call.mockResolvedValue({ status: 200, headers: {}, text: '{"items":[{"id":"c1"}]}' })
        await expect(service.sync(context)).resolves.toEqual({ rows: 1, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenCalledWith({
            baseUrl: "https://owner.example/api",
            op: paged,
            auth,
            input: { pageIndex: 0, limit: 100 },
            fixedQuery: "active=true",
        })
        expect(client.call).toHaveBeenCalledTimes(1)
    })

    it("caps the number of pages in one operation", async () => {
        const paged = operation({ params: [{ name: "page", in: "query", required: false }] })
        const { service, client, context } = await build(config({ ops: [paged] }))
        let page = 0
        client.call.mockImplementation(() => {
            page += 1
            const items = Array.from({ length: 10 }, (_unused, index) => ({ id: `p${page}-c${index}` }))
            return Promise.resolve({ status: 200, headers: {}, text: JSON.stringify({ items }) })
        })
        await expect(service.sync(context)).resolves.toEqual({ rows: 200, meta: { "cursor.customers": "" } })
        expect(client.call).toHaveBeenCalledTimes(20)
    })

    it("returns completed rows alongside a failed operation's detail", async () => {
        const orders = operation({ id: "orders", path: "/orders" })
        const { service, client, context } = await build(
            config({ ops: [operation(), orders], pulls: [pull(), pull({ opId: "orders", entity: "order" })] }),
        )
        client.call.mockRejectedValueOnce(
            new DataSourcesError({
                code: DataSourcesErrorCode.Unavailable,
                params: { detail: "Owner API unavailable" },
            }),
        )
        client.call.mockResolvedValueOnce({ status: 200, headers: {}, text: '{"items":[{"id":"o1"}]}' })
        await expect(service.sync(context)).resolves.toEqual({
            rows: 1,
            meta: { "cursor.orders": "" },
            note: "GET /customers: Owner API unavailable",
        })
        expect(context.upsert).toHaveBeenCalledWith("order", [
            { externalId: "o1", title: "", occurredAt: null, data: { id: "o1" } },
        ])
    })

    it("throws the first known failure when every operation fails", async () => {
        const orders = operation({ id: "orders", path: "/orders" })
        const { service, client, context } = await build(
            config({ ops: [operation(), orders], pulls: [pull(), pull({ opId: "orders", entity: "order" })] }),
        )
        const failure = new DataSourcesError({ code: DataSourcesErrorCode.Unavailable })
        client.call.mockRejectedValueOnce(failure)
        client.call.mockResolvedValueOnce({ status: 500, headers: {}, text: "" })
        await expect(service.sync(context)).rejects.toBe(failure)
        expect(context.upsert).not.toHaveBeenCalled()
    })

    it("uses the error code when a partial failure has no string detail", async () => {
        const orders = operation({ id: "orders", path: "/orders" })
        const { service, client, context } = await build(
            config({ ops: [operation(), orders], pulls: [pull(), pull({ opId: "orders", entity: "order" })] }),
        )
        client.call.mockRejectedValueOnce(
            new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail: 503 } }),
        )
        client.call.mockResolvedValueOnce({ status: 200, headers: {}, text: '{"items":[]}' })
        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            meta: { "cursor.orders": "" },
            note: "GET /customers: DATA_SOURCES_UNAVAILABLE",
        })
    })

    it("clips partial failure notes to 400 characters", async () => {
        const orders = operation({ id: "orders", path: "/orders" })
        const { service, client, context } = await build(
            config({ ops: [operation(), orders], pulls: [pull(), pull({ opId: "orders", entity: "order" })] }),
        )
        client.call.mockResolvedValueOnce({ status: 200, headers: {}, text: '{"items":[]}' })
        client.call.mockRejectedValueOnce(
            new DataHubError({ code: DataHubErrorCode.Invalid, params: { detail: "x".repeat(450) } }),
        )
        await expect(service.sync(context)).resolves.toEqual({
            rows: 0,
            meta: { "cursor.customers": "" },
            note: `GET /orders: ${"x".repeat(387)}`,
        })
    })

    it("reports an HTTP rejection using the existing domain error", async () => {
        const { service, client, context } = await build()
        for (const status of [199, 403]) {
            client.call.mockResolvedValueOnce({ status, headers: {}, text: "" })
            await expect(service.sync(context)).rejects.toMatchObject({
                code: DataHubErrorCode.Invalid,
                params: { detail: openApiFailure(status) },
            })
        }
    })

    it("propagates unexpected failures", async () => {
        const { service, client, context } = await build()
        const failure = new Error("Unexpected client failure")
        client.call.mockRejectedValueOnce(failure)
        await expect(service.sync(context)).rejects.toBe(failure)
    })
})
