import { Test } from "@nestjs/testing"
import { isApiVerb, isCrmOp, isToolId } from "@nivo-lite/agent-sdk/schema"
import table from "./openapi-document.policy.crm-table.json"
import fixture from "./openapi-document.policy.fixtures.json"
import {
    DOCUMENT_MAX_CHARS,
    canonicalJsonOf,
    documentShaOf,
    operationNameOfPath,
    operationOfApiVerb,
    readDocument,
    sourceOf,
    sourceOfApiVerb,
    sourceOfTool,
    sourcePrefixOf,
} from "./openapi-document.policy"
import type { OpenApiSource, PinnedDocument } from "./openapi-tools.contracts"

const SUBJECT = Symbol("openapi-document.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    canonicalJsonOf,
                    documentShaOf,
                    operationNameOfPath,
                    operationOfApiVerb,
                    readDocument,
                    sourceOf,
                    sourceOfApiVerb,
                    sourceOfTool,
                    sourcePrefixOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./openapi-document.policy")>(SUBJECT)
}

type Subject = Awaited<ReturnType<typeof build>>

const TEXT = JSON.stringify(fixture)

/** The provider key of the CRM every document here is read for: the CRM id is fixed by the caller, a document never names it. */
const KEY = "crm.nivoweb"

const CRM: OpenApiSource = { key: KEY, basePath: "/v1" }

/** What a helper answers for a text that is refused: a document with nothing in it. */
const EMPTY: PinnedDocument = {
    sha256: "",
    version: "",
    source: CRM,
    operations: new Map(),
    toolProblems: [],
    securityHeaders: [],
}

const documentOf = (subject: Subject, text: string, key = KEY): PinnedDocument => {
    const reading = subject.readDocument(text, key)
    return reading.ok ? reading.document : EMPTY
}

/** A document of the given paths under the base path the server states (`servers[0].url`, absent when `null`). */
const crmDocumentOf = (paths: unknown, server: string | null = "https://crm.example.test/v1"): string =>
    JSON.stringify({
        openapi: "3.1.0",
        info: { title: "t", version: "1" },
        ...(server === null ? {} : { servers: [{ url: server }] }),
        paths,
    })

/** One row of the CRM table: method, path and the one name the operation is served under. */
type Row = readonly [string, string, string]

/** A row of the table read as a row; a row that is not one fails the spec at load. */
const rowOf = (row: ReadonlyArray<string>): Row => {
    const [method, path, name] = row
    if (typeof method !== "string" || typeof path !== "string" || typeof name !== "string") {
        throw new TypeError(`not a row: ${JSON.stringify(row)}`)
    }
    return [method, path, name]
}

const ROWS: ReadonlyArray<Row> = table.rows.map((row) => rowOf(row))

/** The CRM table as a document: one operation per row, and the operations outside the base path. */
const crmTableDocument = (): string => {
    const paths: Record<string, Record<string, unknown>> = {}
    const add = (method: string, path: string): void => {
        const parameters = [...path.matchAll(/\{([^{}]+)\}/gu)].map((match) => ({
            name: match[1],
            in: "path",
            required: true,
            schema: { type: "string" },
        }))
        paths[path] = { ...paths[path], [method.toLowerCase()]: { parameters, responses: { "200": { description: "ok" } } } }
    }
    for (const [method, path] of ROWS) add(method, path)
    for (const [method, path] of table.outside) add(method ?? "GET", path ?? "/")
    return JSON.stringify({
        openapi: "3.0.3",
        info: { title: "Synthetic CRM", version: "1.0.0", "x-nivo-source": table.source },
        paths,
    })
}

describe("operationNameOfPath", () => {
    it.each(ROWS)("%s %s is %s", async (method, path, name) => {
        const subject = await build()
        expect(subject.operationNameOfPath(CRM, method, path)).toBe(name)
    })

    it("drops the base path, names a parameter without braces, splits camelCase with a dash and lowers the method", async () => {
        const subject = await build()
        expect(subject.operationNameOfPath(CRM, "POST", "/v1/services/{code}/renewals")).toBe("nivo.api.crm.nivoweb.post.services.code.renewals")
        expect(subject.operationNameOfPath(CRM, "POST", "/v1/payables/{partyCode}/notes")).toBe("nivo.api.crm.nivoweb.post.payables.party-code.notes")
        expect(subject.operationNameOfPath(CRM, "GET", "/v1/parties/{partyID}")).toBe("nivo.api.crm.nivoweb.get.parties.party-id")
        expect(subject.operationNameOfPath({ key: "crm.desk", basePath: "" }, "DELETE", "/tickets/{id}")).toBe("nivo.api.crm.desk.delete.tickets.id")
    })

    it("is ONE name: the node's tool and the interface's read are the same text, under the CRM's provider key", async () => {
        const subject = await build()
        const name = subject.operationNameOfPath(CRM, "GET", "/v1/customers/{code}/balance")

        expect(name).toBe("nivo.api.crm.nivoweb.get.customers.code.balance")
        expect(`${subject.sourcePrefixOf(KEY)}get.customers.code.balance`).toBe(name)
        expect(subject.sourceOfTool(name ?? "", [KEY])).toBe(KEY)
        expect(subject.sourceOfApiVerb(name ?? "", [KEY])).toBe(KEY)
    })

    it("is no operation for a path outside the base path, a prefix that only looks like it included", async () => {
        const subject = await build()
        expect(subject.operationNameOfPath(CRM, "POST", "/auth/login")).toBeNull()
        expect(subject.operationNameOfPath(CRM, "GET", "/v10/customers")).toBeNull()
        expect(subject.operationNameOfPath(CRM, "GET", "/health/live")).toBeNull()
    })

    it("is null for a source that is no CRM's provider key", async () => {
        const subject = await build()
        expect(subject.operationNameOfPath({ key: "nivoweb", basePath: "/v1" }, "GET", "/v1/prices")).toBeNull()
    })
})

describe("the CRM table", () => {
    it("reads 43 operations under 43 distinct names, every one a CRM operation by the law, and no operation outside /v1", async () => {
        const subject = await build()
        const document = documentOf(subject, crmTableDocument())
        const ids = [...document.operations.keys()]

        expect(ids.toSorted()).toEqual(ROWS.map(([, , name]) => name).toSorted())
        expect(ids).toHaveLength(43)
        expect(document.toolProblems).toEqual([])
        expect(ids.every((id) => isCrmOp(id) && isToolId(id) && isApiVerb(id) && id.startsWith("nivo.api.crm.nivoweb."))).toBe(true)
        expect([...document.operations.values()].every((operation) => operation.toolId === operation.apiVerb && !operation.purpose)).toBe(true)
        expect([...document.operations.values()].some((operation) => !operation.path.startsWith("/v1/"))).toBe(false)
    })

    it("serves an operation ONLY under its one name, found by it", async () => {
        const subject = await build()
        const document = documentOf(subject, crmTableDocument())

        expect(subject.operationOfApiVerb(document, "nivo.api.crm.nivoweb.get.customers")).toMatchObject({
            method: "GET",
            path: "/v1/customers",
            toolId: "nivo.api.crm.nivoweb.get.customers",
            apiVerb: "nivo.api.crm.nivoweb.get.customers",
            purpose: false,
        })
        expect(subject.operationOfApiVerb(document, "nivo.api.crm.nivoweb.get.customers-code")).toBeNull()
        expect(subject.operationOfApiVerb(document, "nivo.api.crm.other.get.customers")).toBeNull()
    })
})

describe("sourceOf", () => {
    it("reads the source of the CRM it is read for: its provider key and the base path the document states", async () => {
        const subject = await build()

        expect(subject.sourceOf({ servers: [{ url: "https://x.test/v1" }] }, KEY)).toEqual({ ok: true, source: CRM })
        expect(subject.sourceOf({ servers: [{ url: "/v1/" }] }, KEY)).toEqual({ ok: true, source: CRM })
        expect(subject.sourceOf({ info: { "x-nivo-source": { basePath: "/v1" } } }, KEY)).toEqual({ ok: true, source: CRM })
        expect(subject.sourceOf({}, KEY)).toEqual({ ok: true, source: { key: KEY, basePath: "" } })
        expect(subject.sourceOf({ servers: [{ url: "https://x.test" }] }, KEY)).toEqual({ ok: true, source: { key: KEY, basePath: "" } })
    })

    it("lets the first server's path win over the base path an older document states, and never reads the key it states", async () => {
        const subject = await build()
        const document = { servers: [{ url: "https://x.test/v2" }], info: { "x-nivo-source": { key: "other", basePath: "/v1" } } }

        expect(subject.sourceOf(document, KEY)).toEqual({ ok: true, source: { key: KEY, basePath: "/v2" } })
    })

    it("refuses a provider key that is no CRM's and a base path that is no slash-led segments", async () => {
        const subject = await build()
        for (const key of ["nivoweb", "crm", "crm.", "crm.N", "crm.a", "crm.-x", "crm.nivo.web", `crm.${"a".repeat(32)}`, "nivo"]) {
            expect(subject.sourceOf({}, key)).toEqual({ ok: false, problem: "crm_id_invalid" })
        }
        for (const basePath of ["v1", "/v1/", "/", "/{version}"]) {
            expect(subject.sourceOf({ info: { "x-nivo-source": { basePath } } }, KEY)).toEqual({ ok: false, problem: "base_path_invalid" })
        }
        expect(subject.sourceOf({ servers: [{ url: "https://x.test/{version}" }] }, KEY)).toEqual({ ok: false, problem: "base_path_invalid" })
    })
})

describe("readDocument", () => {
    it("lists every operation under the base path by the ONE name it is served under, with its method and path", async () => {
        const subject = await build()
        const document = documentOf(subject, TEXT)

        expect([...document.operations.keys()]).toEqual([
            "nivo.api.crm.nivoweb.get.customers.code",
            "nivo.api.crm.nivoweb.get.customers",
            "nivo.api.crm.nivoweb.get.services.expiring",
            "nivo.api.crm.nivoweb.post.services.code.renewals",
            "nivo.api.crm.nivoweb.post.services.code.reminders",
            "nivo.api.crm.nivoweb.post.renewals.id.confirm",
            "nivo.api.crm.nivoweb.get.tickets",
        ])
        expect(document.operations.get("nivo.api.crm.nivoweb.post.services.code.renewals")).toMatchObject({
            method: "POST",
            path: "/v1/services/{code}/renewals",
            operationId: "service.renewal.create",
            toolId: "nivo.api.crm.nivoweb.post.services.code.renewals",
            apiVerb: "nivo.api.crm.nivoweb.post.services.code.renewals",
            purpose: false,
        })
        expect(document.source).toEqual(CRM)
        expect(document.toolProblems).toEqual([])
        expect(document.version).toBe("3.0.3")
        expect(document.securityHeaders).toEqual(["x-crm-service-key"])
    })

    it("takes the base path from servers[0].url first, and from the base path an older document states only when it has no servers", async () => {
        const subject = await build()
        const paths = { "/v1/things": { get: { responses: {} } }, "/v2/things": { get: { responses: {} } } }
        const stated = (server: string | null): string =>
            JSON.stringify({
                openapi: "3.0.3",
                info: { title: "t", version: "1", "x-nivo-source": { basePath: "/v1" } },
                ...(server === null ? {} : { servers: [{ url: server }] }),
                paths,
            })

        const byServer = documentOf(subject, stated("https://crm.example.test/v2"))
        expect([...byServer.operations.keys()]).toEqual(["nivo.api.crm.nivoweb.get.things"])
        expect([...byServer.operations.values()].map((operation) => operation.path)).toEqual(["/v2/things"])
        expect(byServer.source).toEqual({ key: KEY, basePath: "/v2" })

        const byStatement = documentOf(subject, stated(null))
        expect([...byStatement.operations.values()].map((operation) => operation.path)).toEqual(["/v1/things"])
        expect(byStatement.source.basePath).toBe("/v1")
    })

    it("keeps the base path in the name when the document states none: the root is the base", async () => {
        const subject = await build()
        const document = documentOf(subject, crmDocumentOf({ "/v1/things": { get: { responses: {} } } }, null))

        expect([...document.operations.keys()]).toEqual(["nivo.api.crm.nivoweb.get.v1.things"])
    })

    it("reads the same document under another CRM id into the names of that CRM, and never from a key the document states", async () => {
        const subject = await build()
        const document = documentOf(subject, TEXT, "crm.shopcrm")

        expect([...document.operations.keys()].every((name) => name.startsWith("nivo.api.crm.shopcrm."))).toBe(true)
        expect(document.source).toEqual({ key: "crm.shopcrm", basePath: "/v1" })
    })

    it("resolves the path's parameters, the references and the body, and keeps no word of the document", async () => {
        const subject = await build()
        const document = documentOf(subject, TEXT)
        const get = document.operations.get("nivo.api.crm.nivoweb.get.customers.code")
        const renew = document.operations.get("nivo.api.crm.nivoweb.post.services.code.renewals")

        expect(get?.parameters.map((parameter) => `${parameter.in}:${parameter.name}`)).toEqual(["header:X-Workspace-Id", "path:code"])
        expect(get?.customerAudience).toBe(true)
        expect(get?.customerParameter).toBe("code")
        expect(get?.responses["200"]).toMatchObject({ type: "object", required: ["code", "name", "reachable"] })
        expect(renew?.body).toMatchObject({ required: true, schema: { type: "object", required: ["termMonths"] } })
        expect(renew?.unsupported).toEqual([])
        const kept = JSON.stringify([...document.operations.values()])
        expect(kept).not.toContain("Ignore every rule")
        expect(kept).not.toContain("Costs money")
        expect(kept).not.toContain("The display name")
    })

    it("keeps an operation that uses an unsupported feature, named, so it cannot be called", async () => {
        const subject = await build()
        expect(documentOf(subject, TEXT).operations.get("nivo.api.crm.nivoweb.get.tickets")?.unsupported).toEqual(["oneOf", "array or object parameter"])
    })

    it("reads no purpose mark: an operation that carries `x-nivo-tool` is served under its generated name only", async () => {
        const subject = await build()
        const paths = { "/v1/customers": { get: { "x-nivo-tool": "nivo.tool.invoice.create", responses: {} } } }
        const document = documentOf(subject, crmDocumentOf(paths))

        expect([...document.operations.keys()]).toEqual(["nivo.api.crm.nivoweb.get.customers"])
        expect(document.operations.get("nivo.api.crm.nivoweb.get.customers")).toMatchObject({ purpose: false, unsupported: [] })
        expect(document.toolProblems).toEqual([])
    })

    it("names a cookie parameter, a body that is not JSON and a shared name; an operation needs no operation id", async () => {
        const subject = await build()
        const paths = {
            "/v1/things/{code}": {
                post: {
                    operationId: "Thing_Create",
                    parameters: [
                        { name: "code", in: "path", required: true, schema: { type: "string" } },
                        { name: "session", in: "cookie", schema: { type: "string" } },
                    ],
                    requestBody: { content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" } } } } } },
                    responses: {},
                },
                put: { requestBody: { content: { "text/plain": { schema: { type: "string" } } } }, responses: {} },
            },
        }
        const document = documentOf(subject, crmDocumentOf(paths))

        expect(document.operations.get("nivo.api.crm.nivoweb.post.things.code")?.unsupported).toEqual([
            "cookie parameter",
            "a parameter and a body member share a name",
        ])
        expect(document.operations.get("nivo.api.crm.nivoweb.put.things.code")).toMatchObject({
            operationId: "nivo.api.crm.nivoweb.put.things.code",
            unsupported: ["non-JSON body"],
        })
    })

    it("names a name two operations share on both and keeps one: a camelCase and a dashed segment, or a parameter and a literal, give the same name", async () => {
        const subject = await build()
        const paths = {
            "/v1/fooBar": { get: { responses: {} } },
            "/v1/foo-bar": { get: { responses: {} } },
            "/v1/orders/{code}": { get: { responses: {} } },
            "/v1/orders/code": { get: { responses: {} } },
        }
        const document = documentOf(subject, crmDocumentOf(paths))

        expect(document.toolProblems.map((entry) => `${entry.problem} ${entry.toolId} ${entry.path}`)).toEqual([
            "tool_id_duplicate nivo.api.crm.nivoweb.get.foo-bar /v1/fooBar",
            "tool_id_duplicate nivo.api.crm.nivoweb.get.foo-bar /v1/foo-bar",
            "tool_id_duplicate nivo.api.crm.nivoweb.get.orders.code /v1/orders/{code}",
            "tool_id_duplicate nivo.api.crm.nivoweb.get.orders.code /v1/orders/code",
        ])
        expect(document.operations.get("nivo.api.crm.nivoweb.get.foo-bar")?.unsupported).toEqual(["duplicate tool id"])
        expect(document.operations.get("nivo.api.crm.nivoweb.get.orders.code")?.unsupported).toEqual(["duplicate tool id"])
    })

    it("names a path whose name breaks the law as an unsupported operation, never a refusal of the document", async () => {
        const subject = await build()
        const paths = {
            "/v1/2fa": { get: { responses: {} } },
            "/v1/invoice_drafts": { get: { responses: {} } },
            "/v1/ok": { get: { responses: {} } },
        }
        const reading = subject.readDocument(crmDocumentOf(paths), KEY)
        const document = documentOf(subject, crmDocumentOf(paths))

        expect(reading.ok).toBe(true)
        expect(document.toolProblems.map((entry) => `${entry.problem} ${entry.toolId}`)).toEqual([
            "tool_id_malformed nivo.api.crm.nivoweb.get.2fa",
            "tool_id_malformed nivo.api.crm.nivoweb.get.invoice_drafts",
        ])
        expect(document.operations.get("nivo.api.crm.nivoweb.get.2fa")?.unsupported).toEqual(["operation name breaks the name law"])
        expect(document.operations.get("nivo.api.crm.nivoweb.get.invoice_drafts")?.unsupported).toEqual(["operation name breaks the name law"])
        expect(document.operations.get("nivo.api.crm.nivoweb.get.ok")?.unsupported).toEqual([])
    })
})

describe("readDocument refusals", () => {
    it("refuses Swagger 2.0, YAML, a document without paths, another version and one that is too large", async () => {
        const subject = await build()
        expect(subject.readDocument(JSON.stringify({ swagger: "2.0", paths: {} }), KEY)).toEqual({ ok: false, problem: "swagger_2" })
        expect(subject.readDocument("openapi: 3.0.3\npaths: {}\n", KEY)).toEqual({ ok: false, problem: "not_json" })
        expect(subject.readDocument(JSON.stringify({ openapi: "3.0.3" }), KEY)).toEqual({ ok: false, problem: "no_paths" })
        expect(subject.readDocument(JSON.stringify({ openapi: "4.0.0", paths: {} }), KEY)).toEqual({ ok: false, problem: "not_openapi_3" })
        expect(subject.readDocument(" ".repeat(DOCUMENT_MAX_CHARS + 1), KEY)).toEqual({ ok: false, problem: "too_large" })
    })

    it("refuses a provider key that is no CRM's and a document whose base path is no slash-led segments", async () => {
        const subject = await build()
        expect(subject.readDocument(crmDocumentOf({}), "nivoweb")).toEqual({ ok: false, problem: "crm_id_invalid" })
        expect(subject.readDocument(crmDocumentOf({}), "crm.N")).toEqual({ ok: false, problem: "crm_id_invalid" })
        expect(subject.readDocument(crmDocumentOf({}, "https://x.test/{version}"), KEY)).toEqual({ ok: false, problem: "base_path_invalid" })
    })

    it("needs no source declared: a document that states none is read from the root", async () => {
        const subject = await build()
        expect(subject.readDocument(JSON.stringify({ openapi: "3.0.3", paths: {} }), KEY)).toMatchObject({ ok: true })
    })
})

describe("documentShaOf", () => {
    it("is the same for the same document however its members are ordered or spaced, and differs when a value does", async () => {
        const subject = await build()
        const reordered = JSON.stringify({ paths: fixture.paths, components: fixture.components, openapi: fixture.openapi, info: fixture.info, servers: fixture.servers, security: fixture.security }, null, 4)
        const changed = JSON.stringify({ ...fixture, info: { ...fixture.info, version: "1.0.1" } })

        expect(documentOf(subject, reordered).sha256).toBe(subject.documentShaOf(fixture))
        expect(documentOf(subject, TEXT).sha256).toMatch(/^[0-9a-f]{64}$/u)
        expect(documentOf(subject, changed).sha256).not.toBe(subject.documentShaOf(fixture))
        expect(subject.canonicalJsonOf({ b: 1, a: [{ d: 1, c: 2 }] })).toBe('{"a":[{"c":2,"d":1}],"b":1}')
    })
})
