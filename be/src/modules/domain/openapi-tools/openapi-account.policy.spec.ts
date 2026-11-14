import { Test } from "@nestjs/testing"
import fixture from "./openapi-document.policy.fixtures.json"
import { accountBaseOf, accountFactsOf, accountKeyOf, pinnedMetaOf, pinnedOpsOf, pinnedReadingOf, pinnedTextOf } from "./openapi-account.policy"
import type { ToolsAccountFacts } from "./openapi-tools.contracts"

const SUBJECT = Symbol("openapi-account.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { accountBaseOf, accountFactsOf, accountKeyOf, pinnedMetaOf, pinnedOpsOf, pinnedReadingOf, pinnedTextOf } }],
    }).compile()
    return moduleRef.get<typeof import("./openapi-account.policy")>(SUBJECT)
}

const FACTS: ToolsAccountFacts = {
    connector: "crm.nivoweb",
    swaggerUrl: "https://crm.example.test/v1/openapi.json",
    workspaceHeader: "X-Workspace-Id",
    documentSha256: "a".repeat(64),
    live: false,
    pinnedBy: "member-1",
    pinnedAt: "2026-11-12T00:00:00.000Z",
}
const CONFIG = { v: 1, baseUrl: "https://crm.example.test/", authType: "header", authName: "X-Crm-Service-Key" }

describe("accountFactsOf", () => {
    it("reads back what a pin stored, with the document beside it", async () => {
        const subject = await build()
        const meta = subject.pinnedMetaOf(FACTS, '{"openapi":"3.0.3"}')

        expect(subject.accountFactsOf(meta)).toEqual(FACTS)
        expect(subject.pinnedTextOf(meta)).toBe('{"openapi":"3.0.3"}')
    })

    it("answers nothing for a connection that pinned none, or whose facts are broken", async () => {
        const subject = await build()
        expect(subject.accountFactsOf({})).toBeNull()
        expect(subject.pinnedTextOf({})).toBeNull()
        expect(subject.accountFactsOf({ agentTools: "{" })).toBeNull()
        expect(subject.accountFactsOf({ agentTools: JSON.stringify({ v: 2, ...FACTS }) })).toBeNull()
        expect(subject.accountFactsOf({ agentTools: JSON.stringify({ v: 1, ...FACTS, connector: "CRM tools" }) })).toBeNull()
        // The connector is a CRM provider key (`crm.<id>`): a bare id, an uppercase id and NIVO's own are none.
        expect(subject.accountFactsOf({ agentTools: JSON.stringify({ v: 1, ...FACTS, connector: "nivoweb" }) })).toBeNull()
        expect(subject.accountFactsOf({ agentTools: JSON.stringify({ v: 1, ...FACTS, connector: "crm.Nivoweb" }) })).toBeNull()
        expect(subject.accountFactsOf({ agentTools: JSON.stringify({ v: 1, ...FACTS, connector: "nivo" }) })).toBeNull()
        expect(subject.accountFactsOf({ agentTools: JSON.stringify({ v: 1, ...FACTS, documentSha256: "abc" }) })).toBeNull()
        expect(subject.accountFactsOf({ agentTools: JSON.stringify({ v: 1, ...FACTS, live: "true" }) })?.live).toBe(false)
    })
})

describe("pinnedReadingOf and pinnedOpsOf", () => {
    const pinnedMeta = (facts: ToolsAccountFacts = FACTS) => pinnedMetaOf(facts, JSON.stringify(fixture))

    it("read the pinned document for the CRM the facts name, and list the operations it can call by their one name", async () => {
        const subject = await build()
        const reading = subject.pinnedReadingOf(pinnedMeta())

        expect(reading?.source).toEqual({ key: "crm.nivoweb", basePath: "/v1" })
        expect([...subject.pinnedOpsOf(pinnedMeta())].toSorted()).toEqual([
            "nivo.api.crm.nivoweb.get.customers",
            "nivo.api.crm.nivoweb.get.customers.code",
            "nivo.api.crm.nivoweb.get.services.expiring",
            "nivo.api.crm.nivoweb.post.renewals.id.confirm",
            "nivo.api.crm.nivoweb.post.services.code.reminders",
            "nivo.api.crm.nivoweb.post.services.code.renewals",
        ])
    })

    it("name the operations after the connector the facts hold, so the same document pinned for another CRM id is another set of names", async () => {
        const subject = await build()
        const other = pinnedMeta({ ...FACTS, connector: "crm.shopcrm" })

        expect(subject.pinnedReadingOf(other)?.source.key).toBe("crm.shopcrm")
        expect([...subject.pinnedOpsOf(other)].every((op) => op.startsWith("nivo.api.crm.shopcrm."))).toBe(true)
        expect(subject.pinnedOpsOf(other).has("nivo.api.crm.nivoweb.get.customers")).toBe(false)
    })

    it("answer nothing for a connection that pinned none, whose facts are broken or whose document cannot be read", async () => {
        const subject = await build()
        expect(subject.pinnedReadingOf({})).toBeNull()
        expect(subject.pinnedOpsOf({}).size).toBe(0)
        expect(subject.pinnedOpsOf({ agentTools: pinnedMeta().agentTools ?? "" }).size).toBe(0)
        expect(subject.pinnedOpsOf(pinnedMetaOf(FACTS, "openapi: 3.0.3")).size).toBe(0)
        expect(subject.pinnedOpsOf(pinnedMetaOf(FACTS, JSON.stringify({ swagger: "2.0" }))).size).toBe(0)
    })
})

describe("accountBaseOf", () => {
    it("reads the base URL and how the key is sent from the connection's own configuration", async () => {
        const subject = await build()
        expect(subject.accountBaseOf({ config: JSON.stringify(CONFIG) })).toEqual({ baseUrl: "https://crm.example.test", authType: "header", authName: "X-Crm-Service-Key" })
        expect(subject.accountBaseOf({ config: JSON.stringify({ ...CONFIG, authType: "bearer" }) })).toMatchObject({ authType: "bearer", authName: "" })
    })

    it("refuses a key sent in the query string, with no name, or no way at all", async () => {
        const subject = await build()
        expect(subject.accountBaseOf({ config: JSON.stringify({ ...CONFIG, authType: "query" }) })).toBeNull()
        expect(subject.accountBaseOf({ config: JSON.stringify({ ...CONFIG, authType: "none" }) })).toBeNull()
        expect(subject.accountBaseOf({ config: JSON.stringify({ ...CONFIG, authName: "" }) })).toBeNull()
        expect(subject.accountBaseOf({ config: JSON.stringify({ ...CONFIG, baseUrl: "" }) })).toBeNull()
        expect(subject.accountBaseOf({})).toBeNull()
    })
})

describe("accountKeyOf", () => {
    it("opens the key for the way the base sends it, and answers nothing when none is sealed", async () => {
        const subject = await build()
        const base = { baseUrl: "https://crm.example.test", authType: "header" as const, authName: "X-Crm-Service-Key" }

        expect(subject.accountKeyOf(JSON.stringify({ type: "header", name: "X-Other", value: "k-1" }), base)).toEqual({ type: "header", name: "X-Crm-Service-Key", value: "k-1" })
        expect(subject.accountKeyOf(JSON.stringify({ type: "header", value: "" }), base)).toBeNull()
        expect(subject.accountKeyOf("", base)).toBeNull()
    })
})
