import { Test } from "@nestjs/testing"
import { pinCountsOf, pinReportOf } from "./openapi-pin-report.policy"
import { connectorTakenBy, pinOf } from "./openapi-pin.policy"
import type { OpenApiToolDeclaration } from "./openapi-tools.contracts"

const SUBJECT = Symbol("openapi-pin-report.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { pinCountsOf, pinReportOf } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-pin-report.policy")>(SUBJECT)
}

/** One operation of the synthetic document: its method and the marks a case gives it. */
const operationOf = (method: string, marks: Readonly<Record<string, unknown>> = {}) => ({
    [method]: { ...marks, responses: { "200": { description: "ok" } } },
})

/** A synthetic system: reads opened and closed to customers, writes with every effect mark and with none. Its base path is the server's. */
const DOCUMENT = {
    openapi: "3.0.3",
    info: { title: "Synthetic", version: "1" },
    servers: [{ url: "/v1" }],
    paths: {
        "/v1/customers/{code}": {
            parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }],
            ...operationOf("get", {
                "x-nivo-customer-audience": true,
                "x-nivo-customer-parameter": "code",
            }),
        },
        "/v1/prices": operationOf("get", { "x-nivo-customer-audience": true }),
        "/v1/customers": {
            ...operationOf("get"),
            ...operationOf("post", { "x-nivo-effect": "irreversible" }),
        },
        "/v1/notes": operationOf("post", { "x-nivo-effect": "none" }),
        "/v1/tickets": operationOf("post"),
        "/v1/renewals": operationOf("post"),
        "/v1/summary/counts": operationOf("get"),
        "/auth/login": operationOf("post"),
    },
}

const CONNECTOR = "crm.acme"

const declared = (name: string, reads: boolean): OpenApiToolDeclaration => ({
    tool: `nivo.api.${CONNECTOR}.${name}`,
    connector: CONNECTOR,
    name,
    reads,
})

const DECLARATIONS = [
    declared("get.customers.code", true),
    declared("get.prices", true),
    declared("get.customers", true),
    declared("post.customers", false),
    declared("post.notes", false),
    declared("post.tickets", false),
    declared("post.renewals", true),
    declared("post.invoices", false),
]

const DRAFT = {
    documentText: JSON.stringify(DOCUMENT),
    connector: CONNECTOR,
    swaggerUrl: "",
    workspaceHeader: "X-Workspace-Id",
    live: false,
    pinnedBy: "member-1",
    pinnedAt: "2026-11-12T00:00:00.000Z",
}

const factsOf = () => {
    const pinning = pinOf(DRAFT, DECLARATIONS)
    return {
        connector: pinning.ok ? pinning.connector : "",
        workspaceHeader: "X-Workspace-Id",
        live: false,
        documentSha256: pinning.ok ? pinning.sha256 : "",
        tools: pinning.ok ? pinning.tools : [],
        audiences: pinning.ok ? pinning.audiences : [],
        undeclared: pinning.ok ? pinning.undeclared : [],
    }
}

describe("pinReportOf", () => {
    it("lists each declared tool by its operation name with its state, where it is served, its effect mark and who may call it", async () => {
        const subject = await build()
        const facts = factsOf()
        const [head, sha, counts, ...tools] = subject.pinReportOf(facts)

        expect(head).toBe("connector crm.acme, workspace header X-Workspace-Id, live false")
        expect(sha).toBe(`document sha256 ${facts.documentSha256}`)
        expect(counts).toBe("tools 8: ready 6, missing 1, unsupported 0, mode_mismatch 1; customer audience 2")
        expect(tools).toEqual([
            "  ready nivo.api.crm.acme.get.customers.code GET /v1/customers/{code} effect=unmarked audience=customer(code)",
            "  ready nivo.api.crm.acme.get.prices GET /v1/prices effect=unmarked audience=customer",
            "  ready nivo.api.crm.acme.get.customers GET /v1/customers effect=unmarked audience=internal",
            "  ready nivo.api.crm.acme.post.customers POST /v1/customers effect=irreversible audience=internal",
            "  ready nivo.api.crm.acme.post.notes POST /v1/notes effect=none audience=internal",
            "  ready nivo.api.crm.acme.post.tickets POST /v1/tickets effect=unmarked audience=internal",
            "  mode_mismatch nivo.api.crm.acme.post.renewals POST /v1/renewals effect=unmarked audience=internal",
            "  missing nivo.api.crm.acme.post.invoices - effect=unmarked audience=internal",
            // An operation under the base path no plugin declares is shown by its name; one outside the base path is no operation.
            "  undeclared nivo.api.crm.acme.get.summary.counts GET /v1/summary/counts",
        ])
    })

    it("counts the tools by state and those opened to customers", async () => {
        const subject = await build()
        expect(subject.pinCountsOf(factsOf())).toEqual({
            ready: 6,
            missing: 1,
            unsupported: 0,
            modeMismatch: 1,
            customerAudience: 2,
        })
    })
})

describe("pinOf: the CRM id and the audience marks", () => {
    it("refuses a connector that is no CRM provider key, NIVO's own included", () => {
        expect(pinOf({ ...DRAFT, connector: "nivo" }, [])).toEqual({ ok: false, problem: "crm_id_invalid" })
        expect(pinOf({ ...DRAFT, connector: "acme" }, [])).toEqual({ ok: false, problem: "crm_id_invalid" })
    })

    it("answers the audience marks beside the states, and says when another account's facts already serve the CRM", () => {
        const pinning = pinOf(DRAFT, DECLARATIONS)
        const meta = pinning.ok ? pinning.meta : {}

        expect(pinning.ok ? pinning.audiences.slice(0, 3) : []).toEqual([
            { tool: "nivo.api.crm.acme.get.customers.code", customerAudience: true, customerParameter: "code" },
            { tool: "nivo.api.crm.acme.get.prices", customerAudience: true, customerParameter: null },
            { tool: "nivo.api.crm.acme.get.customers", customerAudience: false, customerParameter: null },
        ])
        expect(connectorTakenBy("crm.acme", [{}, meta])).toBe(true)
        expect(connectorTakenBy("crm.other", [meta])).toBe(false)
        expect(connectorTakenBy("crm.acme", [])).toBe(false)
    })
})
