import { Test } from "@nestjs/testing"
import { CUSTOMER_KNOWN, OutgoingFactReaderService } from "./outgoing-fact-reader.service"

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [OutgoingFactReaderService] }).compile()
    return moduleRef.get(OutgoingFactReaderService)
}

const ALL = [
    "outgoing.amount_vnd",
    "outgoing.has_amount",
    "outgoing.has_link",
    "outgoing.has_phone",
    "outgoing.length",
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
