import { LIST, STACK } from "../spec/spec.fixture"
import { z } from "zod"
import { defineAgentMessageKind } from "../team-chat/agent-message-kinds"
import { entityOf, jobOf, moduleOf, nodeOf, serviceFixture, webhookEventFixture } from "./installation.fixture"
import { registryLinesOf } from "./registry-lines"

describe("registryLinesOf", () => {
    it("writes one `<kind>:<id>@<version>` line per installed thing, sorted by code unit", () => {
        const lines = registryLinesOf([
            { modules: [moduleOf("sales")], blocks: [STACK] },
            { nodes: [nodeOf("nivo.tool.lead.ensure")], jobs: [jobOf("sales.notice")], entities: [entityOf("sales.lead")] },
        ])
        expect(lines).toEqual([
            "action:sales.open@0",
            "block:test.stack@0",
            "entity:sales.lead@0",
            "job:sales.notice@0",
            "module:sales@0",
            "node:nivo.tool.lead.ensure@0",
            "read:sales.people@0",
        ])
    })

    it("writes a `service:<id>@0` line per service, so a new service changes the hash", () => {
        const chat = serviceFixture("pkg.chat.store", "chat")
        expect(registryLinesOf([{ services: [chat] }])).toEqual(["service:pkg.chat.store@0"])
        expect(registryLinesOf([{ services: [chat] }])).not.toEqual(registryLinesOf([{}]))
    })

    it("writes a `webhook-event:<id>@0` line per outgoing event, so a new event changes the hash", () => {
        const won = webhookEventFixture("deal.won", "sales")
        expect(registryLinesOf([{ webhookEvents: [won] }])).toEqual(["webhook-event:deal.won@0"])
        expect(registryLinesOf([{ webhookEvents: [won] }])).not.toEqual(registryLinesOf([{}]))
    })

    it("takes the version a definition declares, and 0 for one that declares none or a non-number", () => {
        const versioned = { ...LIST, version: 3 }
        const textual = { ...STACK, version: "2" }
        expect(registryLinesOf([{ blocks: [versioned, textual] }])).toEqual(["block:test.list@3", "block:test.stack@0"])
    })

    it("gives the same lines whatever the order of the parts and of the lists", () => {
        const one = registryLinesOf([{ blocks: [STACK, LIST] }, { jobs: [jobOf("a.b")] }])
        const other = registryLinesOf([{ jobs: [jobOf("a.b")] }, { blocks: [LIST, STACK] }])
        expect(one).toEqual(other)
    })

    it("keeps equal lines side by side, so a repeated id shows in the text", () => {
        expect(registryLinesOf([{ jobs: [jobOf("a.b")] }, { jobs: [jobOf("a.b")] }])).toEqual([
            "job:a.b@0",
            "job:a.b@0",
        ])
    })

    it("writes one `provider:<kind>:<id>@0` line per declared provider template", () => {
        const template = { kind: "crm", id: "nivoweb", label: { vi: "N", en: "N" }, openapi: {}, swaggerPath: "/openapi.json", auth: { type: "bearer" }, baseUrlHint: "" } as const
        expect(registryLinesOf([{ providers: [template] }])).toEqual(["provider:crm:nivoweb@0"])
    })

    it("writes a `message-kind:<id>@0` line per message kind, so a new kind changes the hash", () => {
        const kind = defineAgentMessageKind({ id: "order.summary", payload: z.object({}), actions: { approve: false, edit: "none", reject: false } })
        expect(registryLinesOf([{ messageKinds: [kind] }])).toEqual(["message-kind:order.summary@0"])
    })

    it("gives no lines for no parts or empty parts", () => {
        expect(registryLinesOf([])).toEqual([])
        expect(registryLinesOf([{}])).toEqual([])
    })
})
