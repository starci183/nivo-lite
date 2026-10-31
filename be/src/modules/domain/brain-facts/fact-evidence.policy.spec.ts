import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import type { Evidence, FactRecord } from "./brain-facts.contracts"
import { factStandsIn } from "./fact-evidence.policy"
import { foldedText } from "./fact-key.policy"

const SUBJECT = Symbol("fact-evidence.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { factStandsIn } }],
    }).compile()
    return moduleRef.get<{ factStandsIn: typeof factStandsIn }>(SUBJECT)
}

const DOC = "doc-1"
const TEXT = foldedText("A visit costs 100,000 VND. Open 8 to 21.")

const own = (quote?: string): Evidence => ({ kind: "document", ref: DOC, label: "Fees", quote })

/** A fact with this value and evidence. */
const factOf = (value: string, evidence: Array<Evidence>): FactRecord => facts.factOf({ value, evidence })

describe("factStandsIn", () => {
    it("is true when the quote is in the text, whatever its accents and case", async () => {
        const subject = await build()

        expect(subject.factStandsIn(factOf("x", [own("A VISIT COSTS 100,000")]), DOC, TEXT)).toBe(true)
    })

    it("is false when the quote is gone", async () => {
        const subject = await build()

        expect(subject.factStandsIn(factOf("100,000", [own("A visit costs 120,000")]), DOC, TEXT)).toBe(false)
    })

    it("falls back on the value when the fact has no quote", async () => {
        const subject = await build()

        expect(subject.factStandsIn(factOf("100,000 VND", [own()]), DOC, TEXT)).toBe(true)
        expect(subject.factStandsIn(factOf("120,000 VND", [own()]), DOC, TEXT)).toBe(false)
    })

    it("does not count a mark too short to prove anything", async () => {
        const subject = await build()

        expect(subject.factStandsIn(factOf("8", [own()]), DOC, TEXT)).toBe(false)
    })

    it("ignores evidence of another document or another kind", async () => {
        const subject = await build()
        const other: Evidence = { kind: "document", ref: "doc-2", label: "Other", quote: "A visit costs" }
        const note: Evidence = { kind: "note", ref: DOC, label: "Note", quote: "A visit costs" }

        expect(subject.factStandsIn(factOf("x", [other, note]), DOC, TEXT)).toBe(false)
    })

    it("is false for an empty text, so a whole withdrawal takes everything", async () => {
        const subject = await build()

        expect(subject.factStandsIn(factOf("100,000 VND", [own("A visit costs")]), DOC, "")).toBe(false)
    })
})
