import { Test } from "@nestjs/testing"
import { isCrmOp } from "@nivo-lite/agent-sdk/schema"
import { toolNamesOf, toolNamesTextOf } from "./openapi-names.policy"

const SUBJECT = Symbol("openapi-names.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toolNamesOf, toolNamesTextOf } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-names.policy")>(SUBJECT)
}

const ok = { responses: { "200": { description: "ok" } } }

const documentOf = (paths: Readonly<Record<string, unknown>>, server = "https://crm.example.test/v1"): string =>
    JSON.stringify({ openapi: "3.0.3", info: { title: "t", version: "1" }, servers: [{ url: server }], paths })

const DOCUMENT = documentOf({
    "/v1/customers": { get: { ...ok, operationId: "customer.find" } },
    "/v1/customers/{code}/balance": { get: { ...ok, operationId: "customer.balance.get" } },
    "/v1/services/{code}/renewals": { post: { ...ok, operationId: "service.renewal.create", "x-nivo-effect": "money" } },
    "/v1/summary/counts": { get: ok },
    "/auth/login": { post: { ...ok, operationId: "auth.login" } },
})

describe("openapi-names.policy toolNamesOf", () => {
    it("names every operation under the base path by the ONE name a node calls and an interface reads, the member it is read by beside it", async () => {
        const subject = await build()
        const reading = subject.toolNamesOf(DOCUMENT, "nivoweb")

        expect(reading).toEqual({
            ok: true,
            basePath: "/v1",
            entries: [
                { member: "get_customers", op: "nivo.api.crm.nivoweb.get.customers", writes: false, at: "GET /v1/customers" },
                {
                    member: "get_customers_code_balance",
                    op: "nivo.api.crm.nivoweb.get.customers.code.balance",
                    writes: false,
                    at: "GET /v1/customers/{code}/balance",
                },
                { member: "get_summary_counts", op: "nivo.api.crm.nivoweb.get.summary.counts", writes: false, at: "GET /v1/summary/counts" },
                {
                    member: "post_services_code_renewals",
                    op: "nivo.api.crm.nivoweb.post.services.code.renewals",
                    writes: true,
                    at: "POST /v1/services/{code}/renewals",
                },
            ],
        })
    })

    it("never reads the operationId or a purpose mark into a name: the name comes from the method and the path alone", async () => {
        const subject = await build()
        const reading = subject.toolNamesOf(
            documentOf({ "/v1/customers": { get: { ...ok, operationId: "customer.find", "x-nivo-tool": "nivo.tool.invoice.create" } } }),
            "nivoweb",
        )

        expect(reading.ok ? reading.entries.map((entry) => entry.op) : []).toEqual(["nivo.api.crm.nivoweb.get.customers"])
    })

    it("takes the base path from servers[0].url, and the root when the document states none", async () => {
        const subject = await build()
        const stated = subject.toolNamesOf(documentOf({ "/v2/things": { get: ok }, "/v1/things": { get: ok } }, "/v2"), "nivoweb")
        const none = subject.toolNamesOf(JSON.stringify({ openapi: "3.0.3", paths: { "/v1/things": { get: ok } } }), "nivoweb")

        expect(stated.ok ? [stated.basePath, ...stated.entries.map((entry) => entry.op)] : []).toEqual(["/v2", "nivo.api.crm.nivoweb.get.things"])
        expect(none.ok ? [none.basePath, ...none.entries.map((entry) => entry.op)] : []).toEqual(["", "nivo.api.crm.nivoweb.get.v1.things"])
    })

    it("gives no names for a text the pin refuses, a CRM id that is none, or a base path that is none", async () => {
        const subject = await build()
        expect(subject.toolNamesOf("{", "nivoweb")).toEqual({ ok: false, problem: "not_json", at: null })
        expect(subject.toolNamesOf(" ".repeat(1_000_001), "nivoweb")).toEqual({ ok: false, problem: "too_large", at: null })
        expect(subject.toolNamesOf(DOCUMENT, "Nivoweb")).toEqual({ ok: false, problem: "crm_id_invalid", at: null })
        expect(subject.toolNamesOf(DOCUMENT, "crm.nivoweb")).toEqual({ ok: false, problem: "crm_id_invalid", at: null })
        expect(subject.toolNamesOf(JSON.stringify({ openapi: "3.0.3", info: {} }), "nivoweb")).toEqual({ ok: false, problem: "no_paths", at: null })
        expect(subject.toolNamesOf(documentOf({}, "https://x.test/{version}"), "nivoweb")).toEqual({ ok: false, problem: "base_path_invalid", at: null })
    })

    it("leaves out an operation whose name breaks the law or that two operations share, and refuses a document whose members collide", async () => {
        const subject = await build()
        const names = (text: string): ReadonlyArray<string> => {
            const reading = subject.toolNamesOf(text, "nivoweb")
            return reading.ok ? reading.entries.map((entry) => entry.op) : []
        }

        expect(names(documentOf({ "/v1/a_b": { get: ok }, "/v1/2fa": { get: ok }, "/v1/ok": { get: ok } }))).toEqual(["nivo.api.crm.nivoweb.get.ok"])
        expect(names(documentOf({ "/v1/fooBar": { get: ok }, "/v1/foo-bar": { get: ok }, "/v1/ok": { get: ok } }))).toEqual(["nivo.api.crm.nivoweb.get.ok"])
        // `a-b` and `a.b` are two names but one member (`get_a_b`): a generated constant cannot hold both.
        expect(subject.toolNamesOf(documentOf({ "/v1/a-b": { get: ok }, "/v1/a/b": { get: ok } }), "nivoweb")).toEqual({
            ok: false,
            problem: "member_duplicate",
            at: "GET /v1/a/b",
        })
    })

    it("names only lawful CRM operations", async () => {
        const subject = await build()
        const reading = subject.toolNamesOf(DOCUMENT, "nivoweb")

        expect(reading.ok && reading.entries.every((entry) => isCrmOp(entry.op))).toBe(true)
    })
})

describe("openapi-names.policy toolNamesTextOf", () => {
    // The generator (agent-sdk names/crm-codegen.ts `crmNamesTextOf`) writes the operation map and the provider key only; it writes no
    // separate `CRM_<ID>_ID` constant (nothing in packages or be reads one): the CRM id is carried by the provider key and the op names.
    it("writes the operation map, the provider key and the augmentation of the SDK's names (a write typed `Asking`, a read `ToolSignature`, every operation an API read)", async () => {
        const subject = await build()
        const reading = subject.toolNamesOf(DOCUMENT, "nivoweb")
        expect(reading.ok).toBe(true)
        if (!reading.ok) return

        const text = subject.toolNamesTextOf("nivoweb", reading)

        expect(text.startsWith("// GENERATED from the OpenAPI document beside this file")).toBe(true)
        expect(text).not.toContain("import ")
        expect(text).toContain(
            [
                "export const CRM_NIVOWEB = {",
                '    get_customers: "nivo.api.crm.nivoweb.get.customers",',
                '    get_customers_code_balance: "nivo.api.crm.nivoweb.get.customers.code.balance",',
                '    get_summary_counts: "nivo.api.crm.nivoweb.get.summary.counts",',
                '    post_services_code_renewals: "nivo.api.crm.nivoweb.post.services.code.renewals",',
                "} as const",
            ].join("\n"),
        )
        expect(text).toContain('export const CRM_NIVOWEB_PROVIDER = "crm.nivoweb" as const\n')
        expect(text).toContain(
            [
                'declare module "@nivo-lite/agent-sdk/names" {',
                "    interface ToolNames {",
                '        "nivo.api.crm.nivoweb.get.customers": ToolSignature',
                '        "nivo.api.crm.nivoweb.get.customers.code.balance": ToolSignature',
                '        "nivo.api.crm.nivoweb.get.summary.counts": ToolSignature',
                '        "nivo.api.crm.nivoweb.post.services.code.renewals": Asking',
                "    }",
                "    interface ApiNames {",
                '        "nivo.api.crm.nivoweb.get.customers": ApiSignature',
                '        "nivo.api.crm.nivoweb.get.customers.code.balance": ApiSignature',
                '        "nivo.api.crm.nivoweb.get.summary.counts": ApiSignature',
                '        "nivo.api.crm.nivoweb.post.services.code.renewals": ApiSignature',
                "    }",
                "    interface ProviderNames {",
                '        "crm.nivoweb": true',
                "    }",
                "}",
                "",
            ].join("\n"),
        )
        expect(subject.toolNamesTextOf("nivoweb", reading)).toBe(text)
    })

    it("names the map of a dashed CRM id with underscores", async () => {
        const subject = await build()
        const reading = subject.toolNamesOf(documentOf({ "/v1/a": { get: ok } }), "my-crm")
        expect(reading.ok).toBe(true)
        if (!reading.ok) return

        const text = subject.toolNamesTextOf("my-crm", reading)

        expect(text).toContain("export const CRM_MY_CRM = {")
        expect(text).toContain('export const CRM_MY_CRM_PROVIDER = "crm.my-crm" as const')
        expect(text).toContain('        "crm.my-crm": true')
        expect(text).toContain('        "nivo.api.crm.my-crm.get.a": ApiSignature')
    })
})
