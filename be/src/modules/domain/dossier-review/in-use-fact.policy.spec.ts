import type { FindingEvidence } from "./dossier-review.contracts"
import { Test } from "@nestjs/testing"
import { inUseOf } from "./in-use-fact.policy"

const SUBJECT = Symbol("policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { inUseOf } }],
    }).compile()
    return moduleRef.get<{ inUseOf: typeof inUseOf }>(SUBJECT)
}

const evidenceOf = (factId: string | null, sourceTitle: string | null): FindingEvidence => ({
    role: "claim",
    label: "Price",
    sourceId: null,
    sourceTitle,
    passageId: null,
    factId,
    factLine: null,
    quote: null,
})

const STANDINGS = new Map([
    ["f-1", { status: "active", value: "450.000" }],
    ["f-2", { status: "proposed", value: "480.000" }],
    ["f-3", { status: "active", value: "500.000" }],
])

describe("inUseOf", () => {
    it("names the value and the document of the one active fact", async () => {
        const { inUseOf } = await buildSubject()
        expect(inUseOf([evidenceOf("f-2", "Menu"), evidenceOf("f-1", "Bang gia 2026")], STANDINGS)).toEqual({
            value: "450.000",
            sourceTitle: "Bang gia 2026",
        })
    })

    it("answers null when both facts are active", async () => {
        const { inUseOf } = await buildSubject()
        expect(inUseOf([evidenceOf("f-1", null), evidenceOf("f-3", null)], STANDINGS)).toBeNull()
    })

    it("answers null when no fact is active, unknown or not a fact", async () => {
        const { inUseOf } = await buildSubject()
        expect(
            inUseOf([evidenceOf("f-2", null), evidenceOf("gone", null), evidenceOf(null, null)], STANDINGS),
        ).toBeNull()
    })
})
