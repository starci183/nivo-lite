import { Test } from "@nestjs/testing"
import { CUSTOMER_KNOWN, OutgoingFactReaderService } from "./outgoing-fact-reader.service"
import type { FactSubject } from "./agent-graphs.port"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [OutgoingFactReaderService] }).compile()
    return moduleRef.get(OutgoingFactReaderService)
}

const SUBJECT: FactSubject = { type: "conversation", id: "conv-1", workItemId: "item-1" }

const ALL = [
    "outgoing.amount_vnd",
    "outgoing.has_amount",
    "outgoing.has_link",
    "outgoing.has_phone",
    "outgoing.length",
    "outgoing.says_received",
    "money.amount_vnd",
    "money.source",
    "money.via",
    CUSTOMER_KNOWN,
    "tool.name",
    "tool.connector",
    "handover.to",
]

describe("OutgoingFactReaderService.facts", () => {
    it("declares the facts of what leaves, the money of the turn, the customer and the call", async () => {
        const reader = await build()

        expect(reader.facts.map((fact) => fact.key)).toEqual(ALL)
        expect(reader.facts.map((fact) => fact.labelKey)).toEqual(ALL.map((key) => `agentGraphs.fact.${key}`))
    })

    it("marks the facts about the text and the turn as never the amount of the work, and counts the sums in dong", async () => {
        const reader = await build()
        const byKey = new Map(reader.facts.map((fact) => [fact.key, fact]))

        expect(byKey.get("outgoing.amount_vnd")).toMatchObject({ type: "number", unit: "vnd", notWorkAmount: true })
        expect(byKey.get("money.amount_vnd")).toMatchObject({ type: "number", unit: "vnd", notWorkAmount: true })
        expect(byKey.get("outgoing.length")).toMatchObject({ type: "number", unit: "count", notWorkAmount: true })
        expect(byKey.get("outgoing.has_link")).toMatchObject({ type: "boolean", unit: null, notWorkAmount: true })
        expect(byKey.get("money.source")).toEqual({
            key: "money.source",
            type: "string",
            unit: null,
            labelKey: "agentGraphs.fact.money.source",
        })
        expect(byKey.get(CUSTOMER_KNOWN)).toMatchObject({ type: "boolean", unit: null })
        expect(byKey.get(CUSTOMER_KNOWN)).not.toHaveProperty("notWorkAmount")
    })
})

describe("OutgoingFactReaderService.read", () => {
    it("reads the facts of the text that would really leave, and only those asked for", async () => {
        const reader = await build()

        await expect(
            reader.read("ws-1", { ...SUBJECT, text: "Tong 5tr, goi 0901234567" }, [
                "outgoing.amount_vnd",
                "outgoing.has_phone",
                "outgoing.says_received",
                "nothing.known",
            ]),
        ).resolves.toEqual({
            "outgoing.amount_vnd": 5_000_000,
            "outgoing.has_phone": true,
            "outgoing.says_received": false,
        })
    })

    it("leaves the facts of the text out for work that sends none, so a branch on them takes its else", async () => {
        const reader = await build()

        await expect(
            reader.read("ws-1", { ...SUBJECT, text: null }, ["outgoing.amount_vnd", "outgoing.length"]),
        ).resolves.toEqual({})
        await expect(reader.read("ws-1", SUBJECT, ["outgoing.amount_vnd"])).resolves.toEqual({})
    })

    it("reads the money of the turn", async () => {
        const reader = await build()
        const money = { asked: true, evidence: [{ amountVnd: 300_000, source: "claimed", via: "chat_text" } as const] }

        await expect(
            reader.read("ws-1", { ...SUBJECT, money }, ["money.amount_vnd", "money.source", "money.via"]),
        ).resolves.toEqual({ "money.amount_vnd": 300_000, "money.source": "claimed", "money.via": "chat_text" })
        await expect(reader.read("ws-1", SUBJECT, ["money.amount_vnd"])).resolves.toEqual({})
    })

    it("tells whether the work names a customer, and says nothing when the road does not know", async () => {
        const reader = await build()

        await expect(reader.read("ws-1", { ...SUBJECT, leadId: "lead-1" }, [CUSTOMER_KNOWN])).resolves.toEqual({
            [CUSTOMER_KNOWN]: true,
        })
        await expect(reader.read("ws-1", { ...SUBJECT, leadId: null }, [CUSTOMER_KNOWN])).resolves.toEqual({
            [CUSTOMER_KNOWN]: false,
        })
        await expect(reader.read("ws-1", SUBJECT, [CUSTOMER_KNOWN])).resolves.toEqual({})
    })

    it("reads what the road knows about the call it is about to make", async () => {
        const reader = await build()
        const attributes = { "tool.name": "gmail.send", "tool.connector": "gmail", "handover.to": "support" }

        await expect(
            reader.read("ws-1", { ...SUBJECT, attributes }, ["tool.name", "tool.connector", "handover.to"]),
        ).resolves.toEqual(attributes)
        await expect(reader.read("ws-1", SUBJECT, ["tool.name"])).resolves.toEqual({})
    })
})
