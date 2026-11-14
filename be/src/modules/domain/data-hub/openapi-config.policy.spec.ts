import type * as SubjectModule from "./openapi-config.policy"
import { Test } from "@nestjs/testing"
import type { OpenApiAuth, OpenApiConfig } from "@modules/integrations/data-sources"
import {
    credentialOf,
    mergeAuth,
    normalizeConfig,
    parseAuth,
    parseConfig,
} from "./openapi-config.policy"

const SUBJECT = Symbol("openapi-config.policy")
type Subject = Pick<
    typeof SubjectModule,
    "normalizeConfig" | "parseConfig" | "parseAuth" | "mergeAuth" | "credentialOf"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { normalizeConfig, parseConfig, parseAuth, mergeAuth, credentialOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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

const EXPECTED_CONFIG = {
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
}

describe("normalizeConfig", () => {
    it.each([undefined, null, [], 5, "invalid", {}])("cleans a missing or non-object config (%p)", async (raw) => {
        const subject = await buildSubject()

        expect(subject.normalizeConfig(raw)).toEqual(emptyConfig)
    })

    it("drops malformed operations and parameters and keeps only GET pulls with known ids", async () => {
        const subject = await buildSubject()

        expect(
            subject.normalizeConfig({
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
        ).toEqual(EXPECTED_CONFIG)
    })
})

describe("normalizeConfig", () => {
    it("clips the public fields at their storage limits and drops unsupported authentication", async () => {
        const subject = await buildSubject()

        const id = "i".repeat(80)
        const path = `/${"p".repeat(499)}`
        const summary = "s".repeat(120)
        const name = "n".repeat(100)
        const field = "f".repeat(200)

        expect(
            subject.normalizeConfig({
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

describe("parseConfig", () => {
    it.each([undefined, null, "", "{", "null", "[]", '"value"'])("returns null for unusable JSON (%p)", async (raw) => {
        const subject = await buildSubject()

        expect(subject.parseConfig(raw)).toBeNull()
    })

    it("normalizes a stored object", async () => {
        const subject = await buildSubject()

        expect(subject.parseConfig('{"baseUrl":"https://api.example/"}')).toEqual({
            ...emptyConfig,
            baseUrl: "https://api.example",
        })
    })
})

describe("parseAuth", () => {
    it.each(["{", "null", "[]", "1", "{}", '{"type":"unknown","value":4,"user":false,"password":null}'])(
        "defaults broken or missing credential fields (%s)",
        async (raw) => {
            const subject = await buildSubject()

            expect(subject.parseAuth(raw)).toEqual({ type: "none", name: "", value: "", user: "", password: "" })
        },
    )

    it("trims and clips the name and type while preserving secret whitespace", async () => {
        const subject = await buildSubject()

        expect(
            subject.parseAuth(
                JSON.stringify({
                    type: " basic ",
                    name: ` ${"n".repeat(101)} `,
                    value: " key ",
                    user: " user ",
                    password: " pass ",
                }),
            ),
        ).toEqual({ type: "basic", name: "n".repeat(100), value: " key ", user: " user ", password: " pass " })
    })
})

describe("mergeAuth and credentialOf", () => {
    it("keeps typed credentials when there is no stored one or its type changed", async () => {
        const subject = await buildSubject()

        const typed = authOf()

        expect(subject.mergeAuth(typed, null)).toBe(typed)
        expect(subject.mergeAuth(typed, authOf({ type: "bearer" }))).toBe(typed)
    })

    it("fills only blank secrets from matching stored credentials", async () => {
        const subject = await buildSubject()

        expect(subject.mergeAuth(authOf({ name: "new", value: "", user: "", password: "" }), authOf())).toEqual(
            authOf({ name: "new" }),
        )
        expect(
            subject.mergeAuth(authOf(), authOf({ value: "old-token", user: "old-user", password: "old-password" })),
        ).toEqual(authOf())
    })

    it("writes the configured type and name and the merged secrets in the legacy order", async () => {
        const subject = await buildSubject()

        expect(subject.credentialOf({ ...emptyConfig, authType: "query", authName: "api_key" }, authOf())).toBe(
            '{"type":"query","name":"api_key","value":"token","user":"owner","password":"secret"}',
        )
    })
})
