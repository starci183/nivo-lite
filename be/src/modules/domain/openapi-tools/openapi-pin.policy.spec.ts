import { Test } from "@nestjs/testing"
import fixture from "./openapi-document.policy.fixtures.json"
import { accountFactsOf, pinnedOpsOf, pinnedTextOf } from "./openapi-account.policy"
import { documentShaOf, readDocument } from "./openapi-document.policy"
import { connectorTakenBy, pinOf, type PinDraft } from "./openapi-pin.policy"
import type { OpenApiToolDeclaration } from "./openapi-tools.contracts"

const SUBJECT = Symbol("openapi-pin.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { pinOf, connectorTakenBy } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-pin.policy")>(SUBJECT)
}

const CONNECTOR = "crm.nivoweb"

const DRAFT: PinDraft = {
    documentText: JSON.stringify(fixture, null, 2),
    connector: CONNECTOR,
    swaggerUrl: "https://crm.example.test/v1/openapi.json",
    workspaceHeader: "X-Workspace-Id",
    live: false,
    pinnedBy: "member-1",
    pinnedAt: "2026-11-12T00:00:00.000Z",
}

/** A tool a package declares on a CRM: its operation name, as the generated constant gives it. */
const declared = (name: string, reads: boolean, connector = CONNECTOR): OpenApiToolDeclaration => ({
    tool: `nivo.api.${connector}.${name}`,
    connector,
    name,
    reads,
})

/** The fixture with a patch applied. */
const textOf = (patch: (document: typeof fixture) => unknown): string => JSON.stringify(patch(structuredClone(fixture)))

describe("pinOf", () => {
    it("stores the canonical document beside its sha256, the CRM id the caller picked and the Swagger URL it came from", async () => {
        const subject = await build()
        const pinning = subject.pinOf(DRAFT, [])
        const meta = pinning.ok ? pinning.meta : {}
        const stored = readDocument(pinnedTextOf(meta) ?? "", CONNECTOR)

        expect(pinning).toMatchObject({ ok: true, connector: CONNECTOR, sha256: documentShaOf(fixture) })
        expect(accountFactsOf(meta)).toEqual({
            connector: CONNECTOR,
            swaggerUrl: "https://crm.example.test/v1/openapi.json",
            workspaceHeader: "X-Workspace-Id",
            documentSha256: documentShaOf(fixture),
            live: false,
            pinnedBy: "member-1",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        })
        expect(stored.ok ? stored.document.sha256 : "").toBe(documentShaOf(fixture))
    })

    it("holds the operations the pin can call, by name, and leaves an unsupported one out", async () => {
        const subject = await build()
        const pinning = subject.pinOf(DRAFT, [])
        const meta = pinning.ok ? pinning.meta : {}

        expect([...pinnedOpsOf(meta)].toSorted()).toEqual([
            "nivo.api.crm.nivoweb.get.customers",
            "nivo.api.crm.nivoweb.get.customers.code",
            "nivo.api.crm.nivoweb.get.services.expiring",
            "nivo.api.crm.nivoweb.post.renewals.id.confirm",
            "nivo.api.crm.nivoweb.post.services.code.reminders",
            "nivo.api.crm.nivoweb.post.services.code.renewals",
        ])
        expect(pinnedOpsOf(meta).has("nivo.api.crm.nivoweb.get.tickets")).toBe(false)
    })

    it("says how each declared tool of the CRM stands, looked up by its name, and lists the operations no tool declares", async () => {
        const subject = await build()
        const declarations = [
            declared("get.customers.code", true),
            declared("get.tickets", true),
            declared("post.tickets.id.close", false),
            declared("post.services.code.reminders", true),
            declared("get.orders.id", true, "crm.erp"),
        ]
        const pinning = subject.pinOf(DRAFT, declarations)

        expect(pinning.ok ? pinning.tools : []).toEqual([
            { tool: "nivo.api.crm.nivoweb.get.customers.code", state: "ready", unsupported: [], method: "GET", path: "/v1/customers/{code}", effect: null },
            { tool: "nivo.api.crm.nivoweb.get.tickets", state: "unsupported", unsupported: ["oneOf", "array or object parameter"], method: "GET", path: "/v1/tickets", effect: null },
            { tool: "nivo.api.crm.nivoweb.post.tickets.id.close", state: "missing", unsupported: [], method: null, path: null, effect: null },
            { tool: "nivo.api.crm.nivoweb.post.services.code.reminders", state: "mode_mismatch", unsupported: [], method: "POST", path: "/v1/services/{code}/reminders", effect: null },
        ])
        expect(pinning.ok ? pinning.undeclared.map((operation) => operation.toolId) : []).toEqual([
            "nivo.api.crm.nivoweb.get.customers",
            "nivo.api.crm.nivoweb.get.services.expiring",
            "nivo.api.crm.nivoweb.post.services.code.renewals",
            "nivo.api.crm.nivoweb.post.renewals.id.confirm",
        ])
    })

    it("pins a CRM id no package declares: a shop's own CRM, whose operations every declared tool of another CRM leaves undeclared", async () => {
        const subject = await build()
        const own = { ...DRAFT, connector: "crm.shopcrm" }
        const pinning = subject.pinOf(own, [declared("get.customers", true)])

        expect(pinning).toMatchObject({ ok: true, connector: "crm.shopcrm", tools: [], audiences: [] })
        expect(pinning.ok ? pinning.undeclared.length : 0).toBe(7)
        expect(pinning.ok ? pinning.undeclared.every((operation) => operation.toolId.startsWith("nivo.api.crm.shopcrm.")) : false).toBe(true)
        expect(accountFactsOf(pinning.ok ? pinning.meta : {})?.connector).toBe("crm.shopcrm")
    })

    it("names the operations by the CRM id the caller picked, never by a key the document states", async () => {
        const subject = await build()
        const stated = textOf((document) => ({
            ...document,
            info: { ...document.info, "x-nivo-source": { key: "other", basePath: "/v1" } },
        }))
        const pinning = subject.pinOf({ ...DRAFT, documentText: stated }, [declared("get.customers", true)])

        expect(pinning.ok ? pinning.tools.map((tool) => `${tool.state} ${tool.tool}`) : []).toEqual(["ready nivo.api.crm.nivoweb.get.customers"])
    })

    it("reads the base path from servers[0].url first: the same operations under another server path are another set of names", async () => {
        const subject = await build()
        const moved = textOf((document) => ({ ...document, servers: [{ url: "https://crm.example.test/v2" }] }))
        const pinning = subject.pinOf({ ...DRAFT, documentText: moved }, [declared("get.customers", true)])

        expect(pinning).toMatchObject({ ok: true, undeclared: [] })
        expect(pinning.ok ? pinning.tools : []).toEqual([
            { tool: "nivo.api.crm.nivoweb.get.customers", state: "missing", unsupported: [], method: null, path: null, effect: null },
        ])
    })

    it("refuses a header that is no name, a connector that is no CRM's provider key and a document it cannot read", async () => {
        const subject = await build()
        expect(subject.pinOf({ ...DRAFT, workspaceHeader: "X Workspace: 1" }, [])).toEqual({ ok: false, problem: "workspace_header_invalid" })
        expect(subject.pinOf({ ...DRAFT, connector: "nivoweb" }, [])).toEqual({ ok: false, problem: "crm_id_invalid" })
        expect(subject.pinOf({ ...DRAFT, connector: "crm.N" }, [])).toEqual({ ok: false, problem: "crm_id_invalid" })
        expect(subject.pinOf({ ...DRAFT, documentText: "openapi: 3.0.3" }, [])).toEqual({ ok: false, problem: "not_json" })
        expect(subject.pinOf({ ...DRAFT, documentText: JSON.stringify({ swagger: "2.0" }) }, [])).toEqual({ ok: false, problem: "swagger_2" })
        expect(subject.pinOf({ ...DRAFT, documentText: JSON.stringify({ openapi: "3.0.3" }) }, [])).toEqual({ ok: false, problem: "no_paths" })
        expect(subject.pinOf({ ...DRAFT, documentText: textOf((document) => ({ ...document, servers: [{ url: "https://x.test/{v}" }] })) }, [])).toEqual({
            ok: false,
            problem: "base_path_invalid",
        })
    })

    it("pins a document that states no source at all: its CRM id is the caller's", async () => {
        const subject = await build()
        const unsourced = textOf((document) => ({ ...document, info: { title: "t", version: "1" } }))

        expect(subject.pinOf({ ...DRAFT, documentText: unsourced }, [])).toMatchObject({ ok: true, connector: CONNECTOR })
    })

    it("is no refusal when two operations share a name or a name breaks the law: they are unsupported operations, listed, and cannot be called", async () => {
        const subject = await build()
        const documentText = textOf((document) => ({
            ...document,
            paths: {
                ...document.paths,
                "/v1/customers/code": { get: { responses: {} } },
                "/v1/2fa": { get: { responses: {} } },
                "/v1/invoice_drafts": { get: { responses: {} } },
            },
        }))
        const pinning = subject.pinOf({ ...DRAFT, documentText }, [
            declared("get.customers.code", true),
            declared("get.2fa", true),
        ])

        expect(pinning.ok).toBe(true)
        expect(pinning.ok ? pinning.tools.map((tool) => `${tool.state} ${tool.tool}`) : []).toEqual([
            "unsupported nivo.api.crm.nivoweb.get.customers.code",
            "unsupported nivo.api.crm.nivoweb.get.2fa",
        ])
        expect(pinning.ok ? pinning.tools.map((tool) => tool.unsupported) : []).toEqual([["duplicate tool id"], ["operation name breaks the name law"]])
        expect(pinnedOpsOf(pinning.ok ? pinning.meta : {}).has("nivo.api.crm.nivoweb.get.customers.code")).toBe(false)
    })

    it("opens a declared tool to customers by the marks the document carries, and closes one it lacks", async () => {
        const subject = await build()
        const pinning = subject.pinOf(DRAFT, [declared("get.customers.code", true), declared("get.nothing", true)])

        expect(pinning.ok ? pinning.audiences : []).toEqual([
            { tool: "nivo.api.crm.nivoweb.get.customers.code", customerAudience: true, customerParameter: "code" },
            { tool: "nivo.api.crm.nivoweb.get.nothing", customerAudience: false, customerParameter: null },
        ])
    })
})

describe("connectorTakenBy", () => {
    it("is true when another open account already serves that CRM id, and false for another CRM or an account that says nothing", async () => {
        const subject = await build()
        const mine = subject.pinOf(DRAFT, [])
        const meta = mine.ok ? mine.meta : {}

        expect(subject.connectorTakenBy(CONNECTOR, [meta])).toBe(true)
        expect(subject.connectorTakenBy("crm.shopcrm", [meta])).toBe(false)
        expect(subject.connectorTakenBy(CONNECTOR, [{}])).toBe(false)
        expect(subject.connectorTakenBy(CONNECTOR, [])).toBe(false)
    })
})
