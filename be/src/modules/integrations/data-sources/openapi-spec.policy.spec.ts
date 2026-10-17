import { Test } from "@nestjs/testing"
import { DataSourcesErrorCode } from "./errors/data-sources.error"
import { OPENAPI_TEXT } from "./messages/openapi.messages"
import { describeSpec } from "./openapi-spec.policy"
const SUBJECT = Symbol("openapi-spec.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { describeSpec } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-spec.policy")>(SUBJECT)
}
const registerSpecValidation = () => {
    it("refuses a document that is not OpenAPI 3 or Swagger 2", async () => {
        const subject = await buildSubject()
        expect(() => subject.describeSpec(null, "")).toThrow(refusal(OPENAPI_TEXT.notSpec))
        expect(() => subject.describeSpec([], "")).toThrow(refusal(OPENAPI_TEXT.notSpec))
        expect(() => subject.describeSpec({ openapi: "2.0" }, "")).toThrow(refusal(OPENAPI_TEXT.notSpec))
        expect(() => subject.describeSpec({ swagger: "1.0" }, "")).toThrow(refusal(OPENAPI_TEXT.notSpec))
        expect(() => subject.describeSpec({ openapi: "3.0.0" }, "")).toThrow(refusal(OPENAPI_TEXT.noOperations))
    })
    it("lists a GET and ignores a path that is not an operation item", async () => {
        const subject = await buildSubject()
        const spec = subject.describeSpec(
            {
                openapi: "3.1.0",
                paths: {
                    orders: get("ignored"),
                    "/orders": get("listOrders", { summary: "  List   orders  " }),
                    "/gone": "nope",
                },
            },
            "https://shop.example/openapi.json",
        )

        expect(spec.title).toBe("")
        expect(spec.baseUrl).toBe("https://shop.example")
        expect(spec.authHint).toEqual({ type: "none", name: "" })
        expect(spec.ops).toEqual([
            {
                id: "listOrders",
                method: "GET",
                path: "/orders",
                summary: " List orders ",
                params: [],
                hasBody: false,
            },
        ])
    })

    it("cleans operation ids, numbers duplicates, and falls back to the method/path and description", async () => {
        const subject = await buildSubject()

        const spec = subject.describeSpec(
            {
                openapi: "3.0.3",
                info: { title: "T".repeat(90) },
                paths: {
                    "/orders": {
                        get: { operationId: "List Orders!", description: "d".repeat(130), responses: {} },
                        post: { operationId: "List Orders!", requestBody: { required: true }, responses: {} },
                        put: { responses: {} },
                    },
                },
            },
            "",
        )

        expect(spec.title).toBe("T".repeat(80))
        expect(spec.ops.map((op) => op.id)).toEqual(["List_Orders", "List_Orders_2", "put__orders"])
        expect(spec.ops[0]?.summary).toBe("d".repeat(120))
        expect(spec.ops[0]?.suggest).toBeUndefined()
        expect(spec.ops[1]?.hasBody).toBe(true)
        expect(spec.ops[1]?.suggest).toBeUndefined()
        expect(spec.baseUrl).toBe("")
    })

    it("keeps at most 500 operations", async () => {
        const subject = await buildSubject()

        const paths: Record<string, unknown> = {}
        for (let index = 0; index < 501; index += 1) paths[`/p${index}`] = get(`op${index}`)

        const spec = subject.describeSpec(
            { openapi: "3.0.0", info: { title: "Shop" }, paths },
            "https://api.example/spec",
        )

        expect(spec.ops).toHaveLength(500)
        expect(spec.ops[499]?.id).toBe("op499")
    })
}

const registerOperationParameters = () => {
    it("lets operation parameters override shared parameters, reads a body, and skips unusable parameters", async () => {
        const subject = await buildSubject()

        const spec = subject.describeSpec(
            {
                swagger: "2.0",
                host: "api.example",
                basePath: "/v1",
                schemes: ["http"],
                paths: {
                    "/orders/{id}": {
                        parameters: [
                            { $ref: "#/parameters/missing" },
                            { name: "id", in: "path" },
                            { name: "limit", in: "query", required: true },
                            { name: "offset", in: "query", required: true },
                            { name: "q", in: "query" },
                            { name: "", in: "query" },
                            { name: "body", in: "body" },
                            { name: "nope", in: "cookie" },
                        ],
                        get: {
                            operationId: "getOrder",
                            parameters: [
                                { name: "X-Shop", in: "header", required: false },
                                { name: "limit", in: "query" },
                            ],
                            responses: {
                                default: {
                                    schema: {
                                        type: "array",
                                        items: { type: "object", properties: { id: {}, name: {} } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            "https://files.example/spec.json",
        )

        expect(spec.baseUrl).toBe("http://api.example/v1")
        expect(spec.ops[0]).toMatchObject({
            id: "getOrder",
            hasBody: true,
            params: [
                { name: "id", in: "path", required: true },
                { name: "limit", in: "query", required: false },
                { name: "offset", in: "query", required: true },
                { name: "q", in: "query", required: false },
                { name: "X-Shop", in: "header", required: false },
            ],
            suggest: { itemsPath: "", idField: "id", titleField: "name" },
        })
    })
}

const registerResponseFields = () => {
    it("suggests fields from a referenced response and a nested array", async () => {
        const subject = await buildSubject()

        const spec = subject.describeSpec(
            {
                openapi: "3.0.0",
                servers: [
                    {
                        url: "https://api.example/{version}/{missing}/",
                        variables: { version: { default: "v1" }, missing: "nope" },
                    },
                ],
                paths: {
                    "/items": {
                        get: {
                            responses: {
                                "201": {
                                    content: {
                                        "text/plain": { schema: { type: "string" } },
                                        "application/json": { schema: { $ref: "#/components/schemas/Page" } },
                                    },
                                },
                            },
                        },
                    },
                },
                components: {
                    schemas: {
                        Page: {
                            type: "object",
                            properties: {
                                data: {
                                    type: "object",
                                    properties: {
                                        items: { type: "array", items: { $ref: "#/components/schemas/Item" } },
                                    },
                                },
                            },
                        },
                        Item: { type: "object", properties: { sku: {}, title: {} } },
                    },
                },
            },
            "https://files.example/spec.yaml",
        )

        expect(spec.baseUrl).toBe("https://api.example/v1")
        expect(spec.ops[0]?.suggest).toEqual({ itemsPath: "data.items", idField: "sku", titleField: "title" })
    })
}

const registerSchemaReferences = () => {
    it("ignores external references while keeping usable local operations and parameters", async () => {
        const subject = await buildSubject()

        const spec = subject.describeSpec(
            {
                openapi: "3.0.0",
                paths: {
                    "/external": { $ref: "https://other.example/paths.json#/orders" },
                    "/orders/{id}": get("getOrder", {
                        parameters: [
                            { $ref: "https://other.example/parameters.json#/limit" },
                            { name: "id", in: "path" },
                        ],
                        responses: { "200": { $ref: "https://other.example/responses.json#/Order" } },
                    }),
                },
            },
            "https://api.example/spec.json",
        )

        expect(spec.ops).toEqual([
            {
                id: "getOrder",
                method: "GET",
                path: "/orders/{id}",
                summary: "",
                params: [{ name: "id", in: "path", required: true }],
                hasBody: false,
            },
        ])
    })

    it.each<[string, Record<string, unknown>]>([
        ["missing responses", { responses: undefined }],
        ["an array without an item schema", { responses: { "200": { schema: { type: "array" } } } }],
        [
            "an unresolved array item reference",
            { responses: { "200": { schema: { type: "array", items: { $ref: "#/components/schemas/Missing" } } } } },
        ],
        ["empty response content", { responses: { "200": { content: {} } } }],
    ])("keeps the operation without field suggestions for %s", async (_label, extra) => {
        const subject = await buildSubject()

        const spec = subject.describeSpec(
            { openapi: "3.0.0", paths: { "/orders": get("listOrders", extra) } },
            "https://api.example/spec.json",
        )

        expect(spec.ops).toEqual([
            {
                id: "listOrders",
                method: "GET",
                path: "/orders",
                summary: "",
                params: [],
                hasBody: false,
            },
        ])
    })
}

const registerSchemaTraversal = () => {
    it("locates a primitive array without suggesting nonexistent item fields", async () => {
        const subject = await buildSubject()

        const spec = subject.describeSpec(
            {
                openapi: "3.0.0",
                paths: {
                    "/tags": get("listTags", {
                        responses: {
                            "200": {
                                content: {
                                    "application/json": { schema: { type: "array", items: { type: "string" } } },
                                },
                            },
                        },
                    }),
                },
            },
            "https://api.example/spec.json",
        )

        expect(spec.ops[0]?.suggest).toEqual({ itemsPath: "", idField: "", titleField: "" })
    })

    it("fills an empty server variable, stops past two levels, and follows a json pointer escape", async () => {
        const subject = await buildSubject()

        const schemas: Record<string, unknown> = {
            "a/b~c": { type: "array", items: { type: "object", properties: { code: {} } } },
        }
        for (let depth = 8; depth >= 0; depth -= 1) {
            schemas[`n${depth}`] = {
                $ref: depth === 8 ? "#/components/schemas/a~1b~0c" : `#/components/schemas/n${depth + 1}`,
            }
        }

        const spec = subject.describeSpec(
            {
                openapi: "3.0.0",
                servers: [{ url: "/{root}", variables: {} }],
                paths: nestedSchemas,
                components: { schemas },
            },
            "https://api.example/spec",
        )

        expect(spec.baseUrl).toBe("https://api.example")
        expect(spec.ops[0]?.suggest).toBeUndefined()
        expect(spec.ops[1]?.suggest).toEqual({ itemsPath: "rows", idField: "id", titleField: "" })
        expect(spec.ops[2]?.suggest).toEqual({ itemsPath: "", idField: "code", titleField: "" })
        expect(spec.ops[3]?.suggest).toBeUndefined()
    })
}

const registerAuthHints = () => {
    it("reads the auth hint from the first usable scheme", async () => {
        const subject = await buildSubject()
        const hint = (schemes: Record<string, unknown>) =>
            subject.describeSpec(
                { openapi: "3.0.0", paths: { "/ping": get("ping") }, components: { securitySchemes: schemes } },
                "https://api.example",
            ).authHint
        expect(hint({ broken: { $ref: "#/nope" }, key: { type: "apiKey", in: "query", name: "api_key" } })).toEqual({
            type: "query",
            name: "api_key",
        })
        expect(hint({ key: { type: "apiKey", in: "header", name: "X-Key" } })).toEqual({
            type: "header",
            name: "X-Key",
        })
        expect(hint({ basic: { type: "basic" } })).toEqual({ type: "basic", name: "" })
        expect(hint({ basic: { type: "http", scheme: "Basic" } })).toEqual({ type: "basic", name: "" })
        expect(hint({ token: { type: "http", scheme: "bearer" } })).toEqual({ type: "bearer", name: "" })
        expect(hint({ oauth: { type: "oauth2" } })).toEqual({ type: "bearer", name: "" })
        expect(hint({ oidc: { type: "openIdConnect" } })).toEqual({ type: "bearer", name: "" })
        expect(hint({ other: { type: "mutual" } })).toEqual({ type: "none", name: "" })
        expect(
            subject.describeSpec(
                {
                    swagger: "2.0",
                    securityDefinitions: { key: { type: "apiKey", in: "header", name: "X-Key" } },
                    paths: { "/ping": get("ping") },
                },
                "",
            ).authHint,
        ).toEqual({ type: "header", name: "X-Key" })
    })
    it("builds a swagger base from the host, the scheme list, or the spec url", async () => {
        const subject = await buildSubject()
        expect(
            subject.describeSpec(
                { swagger: "2.0", schemes: ["http", "https"], host: "api.example", paths: { "/ping": get("ping") } },
                "",
            ).baseUrl,
        ).toBe("https://api.example")
        expect(
            subject.describeSpec(
                { swagger: "2.0", host: "api.example", basePath: "/", paths: { "/ping": get("ping") } },
                "",
            ).baseUrl,
        ).toBe("https://api.example")
        expect(
            subject.describeSpec(
                { swagger: "2.0", basePath: "/v1/", paths: { "/ping": get("ping") } },
                "https://files.example/a/spec.json",
            ).baseUrl,
        ).toBe("https://files.example/v1")
        expect(subject.describeSpec({ swagger: "2.0", paths: { "/ping": get("ping") } }, "").baseUrl).toBe("")
        expect(
            subject.describeSpec(
                { openapi: "3.0.0", servers: [{ url: "https://api.example/v1/" }], paths: { "/ping": get("ping") } },
                "",
            ).baseUrl,
        ).toBe("https://api.example/v1")
        expect(
            subject.describeSpec({ openapi: "3.0.0", servers: "nope", paths: { "/ping": get("ping") } }, "").baseUrl,
        ).toBe("")
    })
    it("keeps an absolute HTTP server URL when the spec URL cannot be parsed", async () => {
        const subject = await buildSubject()

        const spec = subject.describeSpec(
            { openapi: "3.0.0", servers: [{ url: "https://api.example/v1/" }], paths: { "/ping": get("ping") } },
            "not-a-url",
        )

        expect(spec.baseUrl).toBe("https://api.example/v1")
    })
}

const registerDefaultScheme = () => {
    it("defaults a missing entry in an in-memory Swagger scheme list to HTTPS", async () => {
        const subject = await buildSubject()

        const schemes: Array<string> = []
        schemes.length = 1
        const spec = subject.describeSpec(
            { swagger: "2.0", schemes, host: "api.example", paths: { "/ping": get("ping") } },
            "",
        )

        expect(spec.baseUrl).toBe("https://api.example")
    })
}

const nestedSchemas = {
    "/deep": {
        get: {
            responses: {
                "200": {
                    schema: {
                        type: "object",
                        properties: {
                            a: {
                                type: "object",
                                properties: {
                                    b: {
                                        type: "object",
                                        properties: { c: { type: "array", items: { type: "object" } } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    "/near": {
        get: {
            responses: {
                "200": {
                    content: {
                        "application/problem+json": {
                            schema: {
                                type: "object",
                                properties: {
                                    rows: {
                                        type: "array",
                                        items: { type: "object", properties: { id: {} } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    "/escaped": {
        get: {
            responses: {
                "200": { schema: { $ref: "#/components/schemas/a~1b~0c" } },
            },
        },
    },
    "/too-deep": {
        get: {
            responses: { "200": { schema: { $ref: "#/components/schemas/n0" } } },
        },
    },
}

const refusal = (detail: string) => expect.objectContaining({ code: DataSourcesErrorCode.Rejected, params: { detail } })

const get = (operationId: string, extra: Record<string, unknown> = {}) => ({
    get: { operationId, responses: { "200": { description: "ok" } }, ...extra },
})

describe("describeSpec", () => {
    registerSpecValidation()
    registerOperationParameters()
    registerResponseFields()
    registerSchemaReferences()
    registerSchemaTraversal()
    registerAuthHints()
    registerDefaultScheme()
})
