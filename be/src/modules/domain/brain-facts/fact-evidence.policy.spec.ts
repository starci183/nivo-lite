import * as facts from "@tests/fixtures/builders/brain-facts.builder"

import { Test } from "@nestjs/testing"
import type { Evidence, FactRecord } from "./brain-facts.contracts"
import { NOTHING_STANDS, evidenceAfterChange, factStandsIn } from "./fact-evidence.policy"
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

describe("evidenceAfterChange: a changed chunk touches only the facts born from it", () => {
    const SOURCE = "doc-1"
    const piece = (chunkHash: string | undefined, quote = "Ship 20.000"): Evidence => ({
        kind: "document",
        ref: SOURCE,
        label: "Rules",
        quote,
        ...(chunkHash === undefined ? {} : { chunkHash }),
    })
    const unchanged = { hashes: ["h-hours", "h-pay"], folded: "open 8 to 20 pay by transfer" }

    it("leaves a fact born from an unchanged chunk untouched, whatever its quote says", () => {
        const fact = { value: "8 to 20", evidence: [piece("h-hours", "a quote no longer in any text")] }

        expect(evidenceAfterChange(fact, SOURCE, unchanged)).toEqual({ touched: false, rest: fact.evidence })
    })

    it("drops the piece of a changed chunk and keeps the other sources", () => {
        const other: Evidence = { kind: "manual", ref: "manual:1", label: "Owner" }
        const fact = { value: "20.000", evidence: [piece("h-ship"), other] }

        expect(evidenceAfterChange(fact, SOURCE, unchanged)).toEqual({ touched: true, rest: [other] })
    })

    it("keeps the piece of an unchanged chunk when the same fact also rested on a changed one", () => {
        const fact = { value: "8 to 20", evidence: [piece("h-ship"), piece("h-hours")] }

        expect(evidenceAfterChange(fact, SOURCE, unchanged)).toEqual({ touched: true, rest: [piece("h-hours")] })
    })

    it("judges evidence read before chunk hashes by its quote in the unchanged text", () => {
        expect(
            evidenceAfterChange({ value: "x", evidence: [piece(undefined, "Pay by transfer")] }, SOURCE, unchanged)
                .touched,
        ).toBe(false)
        expect(
            evidenceAfterChange({ value: "x", evidence: [piece(undefined, "Ship 20.000")] }, SOURCE, unchanged).touched,
        ).toBe(true)
    })

    it("never touches the evidence of another document", () => {
        const fact = { value: "x", evidence: [{ ...piece("h-gone"), ref: "doc-2" }] }

        expect(evidenceAfterChange(fact, SOURCE, NOTHING_STANDS).touched).toBe(false)
    })
})
