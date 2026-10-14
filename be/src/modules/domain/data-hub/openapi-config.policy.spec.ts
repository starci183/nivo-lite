import type { OpenApiAuth, OpenApiConfig } from "@modules/integrations/data-sources"
import {
    cleanAuth,
    credentialOf,
    mergeAuth,
    normalizeConfig,
    parseAuth,
    parseConfig,
    summaryOf,
} from "./openapi-config.policy"

const emptyConfig: OpenApiConfig = {
    v: 1,
    specUrl: "",
    baseUrl: "",
    authType: "none",
    authName: "",
    ops: [],
    pulls: [],
    tools: [],
}

const authOf = (overrides: Partial<OpenApiAuth> = {}): OpenApiAuth => ({
    type: "basic",
    name: "Authorization",
    value: "token",
    user: "owner",
    password: "secret",
    ...overrides,
})

describe("normalizeConfig", () => {
    it.each([undefined, null, [], 5, "invalid", {}])("cleans a missing or non-object config (%p)", (raw) => {
        expect(normalizeConfig(raw)).toEqual(emptyConfig)
    })

    it("drops malformed operations and parameters and keeps only GET pulls with known ids", () => {
        expect(
            normalizeConfig({
                specUrl: " https://api.example/spec ",
                baseUrl: " https://api.example/// ",
                authType: " header ",
                authName: " X-Key ",
                ops: [
                    null,
                    [],
                    { id: "wrong-method", method: "HEAD", path: "/records" },
                    { id: "wrong-path", method: "GET", path: "records" },
                    { id: "", method: "GET", path: "/records" },
                    {
                        id: " list ",
                        method: " get ",
                        path: " /records ",
                        summary: " List records ",
                        params: [
                            null,
                            { in: " path ", name: " id ", required: true },
                            { in: "query", name: "q", required: "true" },
                            { in: "header", name: "X-Trace", required: false },
                            { in: "body", name: "payload", required: true },
                            { in: "query", name: " " },
                        ],
                        hasBody: true,
                    },
                    { id: "create", method: "POST", path: "/records", params: "invalid", hasBody: "true" },
                ],
                pulls: [
                    null,
                    { opId: "missing" },
                    { opId: "create", entity: "order" },
                    {
                        opId: " list ",
                        entity: " customer ",
                        itemsPath: " data.items ",
                        idField: " record.id ",
                        titleField: " name ",
                        fixedQuery: " ?status=active ",
                    },
                    { opId: "list", entity: "unknown" },
                ],
                tools: [" list ", "missing", "list", "create", 3],
            }),
        ).toEqual({
            v: 1,
            specUrl: "https://api.example/spec",
            baseUrl: "https://api.example",
            authType: "header",
            authName: "X-Key",
            ops: [
                {
                    id: "list",
                    method: "GET",
                    path: "/records",
                    summary: "List records",
                    params: [
                        { in: "path", name: "id", required: true },
                        { in: "query", name: "q", required: false },
                        { in: "header", name: "X-Trace", required: false },
                    ],
                    hasBody: true,
                },
                { id: "create", method: "POST", path: "/records", summary: "", params: [], hasBody: false },
            ],
            pulls: [
                {
                    opId: "list",
                    entity: "customer",
                    itemsPath: "data.items",
                    idField: "record.id",
                    titleField: "name",
                    fixedQuery: "status=active",
                },
                { opId: "list", entity: "other", itemsPath: "", idField: "", titleField: "", fixedQuery: "" },
            ],
            tools: ["list", "create"],
        })
    })

    it("clips the public fields at their storage limits and drops unsupported authentication", () => {
        const id = "i".repeat(80)
        const path = `/${"p".repeat(499)}`
        const summary = "s".repeat(120)
        const name = "n".repeat(100)
        const field = "f".repeat(200)

        expect(
            normalizeConfig({
                specUrl: "s".repeat(1001),
                baseUrl: "b".repeat(1001),
                authType: "unsupported",
                authName: "a".repeat(101),
                ops: [
                    {
                        id: `${id}x`,
                        method: "DELETE",
                        path: `${path}x`,
                        summary: `${summary}x`,
                        params: [{ in: "query", name: `${name}x`, required: true }],
                    },
                    { id: "read", method: "GET", path: "/read" },
                ],
                pulls: [
                    {
                        opId: "read",
                        entity: "product",
                        itemsPath: `${field}x`,
                        idField: `${field}x`,
                        titleField: `${field}x`,
                        fixedQuery: "q".repeat(501),
                    },
                ],
                tools: [`${id}x`],
            }),
        ).toEqual({
            v: 1,
            specUrl: "s".repeat(1000),
            baseUrl: "b".repeat(1000),
            authType: "none",
            authName: "a".repeat(100),
            ops: [
                {
                    id,
                    method: "DELETE",
                    path,
                    summary,
                    params: [{ in: "query", name, required: true }],
                    hasBody: false,
                },
                { id: "read", method: "GET", path: "/read", summary: "", params: [], hasBody: false },
            ],
            pulls: [
                {
                    opId: "read",
                    entity: "product",
                    itemsPath: field,
                    idField: field,
                    titleField: field,
                    fixedQuery: "q".repeat(500),
                },
            ],
            tools: [id],
        })
    })
})

describe("parseConfig and summaryOf", () => {
    it.each([undefined, null, "", "{", "null", "[]", '"value"'])("returns null for unusable JSON (%p)", (raw) => {
        expect(parseConfig(raw)).toBeNull()
    })

    it("normalizes a stored object and describes the pull and tool counts", () => {
        expect(parseConfig('{"baseUrl":"https://api.example/"}')).toEqual({
            ...emptyConfig,
            baseUrl: "https://api.example",
        })
        const config = normalizeConfig({
            ops: [{ id: "list", method: "GET", path: "/records" }],
            pulls: [{ opId: "list" }, { opId: "list" }],
            tools: ["list"],
        })

        expect(summaryOf(config)).toBe("2 API k\u00e9o d\u1eef li\u1ec7u \u00b7 1 API cho agent")
        expect(summaryOf(emptyConfig)).toBe("0 API k\u00e9o d\u1eef li\u1ec7u \u00b7 0 API cho agent")
    })
})

describe("parseAuth and cleanAuth", () => {
    it.each(["{", "null", "[]", "1", "{}", '{"type":"unknown","value":4,"user":false,"password":null}'])(
        "defaults broken or missing credential fields (%s)",
        (raw) => {
            expect(parseAuth(raw)).toEqual({ type: "none", name: "", value: "", user: "", password: "" })
        },
    )

    it("trims and clips the name and type while preserving secret whitespace", () => {
        expect(
            parseAuth(
                JSON.stringify({
                    type: " basic ",
                    name: ` ${"n".repeat(101)} `,
                    value: " key ",
                    user: " user ",
                    password: " pass ",
                }),
            ),
        ).toEqual({ type: "basic", name: "n".repeat(100), value: " key ", user: " user ", password: " pass " })
        expect(
            cleanAuth({ type: " bearer ", name: " Authorization ", value: " token ", user: "", password: "" }),
        ).toEqual({
            type: "bearer",
            name: "Authorization",
            value: " token ",
            user: "",
            password: "",
        })
        expect(cleanAuth({ type: "invalid", name: " key ", value: "secret", user: "", password: "" })).toEqual({
            type: "none",
            name: "key",
            value: "secret",
            user: "",
            password: "",
        })
    })
})

describe("mergeAuth and credentialOf", () => {
    it("keeps typed credentials when there is no stored one or its type changed", () => {
        const typed = authOf()

        expect(mergeAuth(typed, null)).toBe(typed)
        expect(mergeAuth(typed, authOf({ type: "bearer" }))).toBe(typed)
    })

    it("fills only blank secrets from matching stored credentials", () => {
        expect(mergeAuth(authOf({ name: "new", value: "", user: "", password: "" }), authOf())).toEqual(
            authOf({ name: "new" }),
        )
        expect(mergeAuth(authOf(), authOf({ value: "old-token", user: "old-user", password: "old-password" }))).toEqual(
            authOf(),
        )
    })

    it("writes the configured type and name and the merged secrets in the legacy order", () => {
        expect(credentialOf({ ...emptyConfig, authType: "query", authName: "api_key" }, authOf())).toBe(
            '{"type":"query","name":"api_key","value":"token","user":"owner","password":"secret"}',
        )
    })
})
