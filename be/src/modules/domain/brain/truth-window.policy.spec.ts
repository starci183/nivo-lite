import { Test } from "@nestjs/testing"
import type { AiChatAttempt } from "@modules/integrations/ai"
import { docSourceOf } from "@tests/fixtures/builders/document-facts.builder"
import { cutOf, documentEvidenceOf, followUpFor, halvesOf, readsBetter, splitAt, wroteNothingUsable } from "./truth-window.policy"
import type { ExtractedFact, ParsedFacts } from "./extraction.policy"

const SUBJECT = Symbol("truth-window.policy")

/** The policy's own functions, provided through a testing module the way Nest builds a subject. */
const build = async (): Promise<typeof import("./truth-window.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cutOf, documentEvidenceOf, followUpFor, halvesOf, readsBetter, splitAt, wroteNothingUsable } }],
    }).compile()
    return moduleRef.get<typeof import("./truth-window.policy")>(SUBJECT)
}

const FACT: ExtractedFact = {
    subjectType: "policy",
    subjectLabel: "Giao hang",
    attributeLabel: "phi",
    value: "30.000",
    unit: null,
    validFrom: null,
    validTo: null,
    quote: "phi 30.000",
    passage: { id: "p", text: "phi 30.000", hash: "h" },
}

const USAGE = { promptTokens: 10, completionTokens: 5, totalTokens: 15, costUsd: 0.0001 }
const cut: AiChatAttempt = { ok: false, failure: "length", spent: { model: "m", usage: USAGE, served: { upstream: null, finishReason: "max_tokens", durationMs: 1 }, cap: 200 } }
const parsedOf = (fields: Partial<ParsedFacts>): ParsedFacts => ({
    facts: [],
    dropped: 0,
    ungrounded: 0,
    refused: [],
    faults: [],
    unclear: [],
    foreign: 0,
    unaccounted: [],
    valid: true,
    ...fields,
})

describe("truth-window.policy: a try that cannot be used is never asked again unchanged", () => {
    let subject: typeof import("./truth-window.policy")

    beforeEach(async () => {
        subject = await build()
    })

    it("tells a try cut at its cap or answered empty (split / follow-up) from one the model never answered (queue retry)", () => {
        expect([subject.cutOf(cut), subject.wroteNothingUsable(cut)]).toEqual([true, true])
        expect(subject.wroteNothingUsable({ ok: false, failure: "empty" })).toBe(true)
        expect(subject.wroteNothingUsable({ ok: false, failure: "timeout" })).toBe(false)
        expect(subject.cutOf({ ok: false, failure: "provider" })).toBe(false)
    })

    it("splits a batch in two halves in its place", () => {
        expect(subject.halvesOf([1, 2, 3])).toEqual([[1, 2], [3]])
        expect(subject.splitAt([[1], [2, 3, 4, 5], [6]], 1)).toEqual([[1], [2, 3], [4, 5], [6]])
    })

    it("asks once more for an unreadable or all-ungrounded answer (format) or foreign labels (language), else takes it", () => {
        expect(subject.followUpFor(parsedOf({ valid: false }))).toBe("format")
        expect(subject.followUpFor(parsedOf({ ungrounded: 10 }))).toBe("format")
        expect(subject.followUpFor(parsedOf({ foreign: 1 }))).toBe("language")
        expect(subject.followUpFor(parsedOf({}))).toBeNull()
    })

    it("keeps the second answer only when it reads better for the reason it was asked", () => {
        const none = parsedOf({ ungrounded: 10 })
        expect(subject.readsBetter(parsedOf({ facts: [FACT] }), none, "format")).toBe(true)
        expect(subject.readsBetter(none, none, "format")).toBe(false)
        const english = parsedOf({ facts: [FACT], foreign: 1 })
        expect(subject.readsBetter(parsedOf({ facts: [FACT], foreign: 0 }), english, "language")).toBe(true)
        expect(subject.readsBetter(parsedOf({ facts: [], foreign: 0 }), english, "language")).toBe(false)
    })

    it("asks once more for truth lines refused for a reason the model can mend, before lines left unaccounted", () => {
        const refused = parsedOf({ facts: [FACT], faults: ["1|x|y => why"], unaccounted: ["1:L2"] })
        expect(subject.followUpFor(refused)).toBe("refused")
        expect(subject.followUpFor(parsedOf({ facts: [FACT], unaccounted: ["1:L2"] }))).toBe("unaccounted")
    })

    it("takes a follow-up for refused or unaccounted lines only when it loses fewer lines and keeps every truth", () => {
        const first = parsedOf({ facts: [FACT], faults: ["1|x|y => why"], unaccounted: ["1:L2"] })
        expect(subject.readsBetter(parsedOf({ facts: [FACT, FACT] }), first, "refused")).toBe(true)
        expect(subject.readsBetter(first, first, "refused")).toBe(false)
        // Mending the refused line while dropping a truth read before is not better: the answer is taken whole.
        expect(subject.readsBetter(parsedOf({ facts: [] }), first, "refused")).toBe(false)
        expect(subject.readsBetter(parsedOf({ facts: [FACT], unaccounted: ["1:L2"], faults: ["2|x|y => why"] }), first, "unaccounted")).toBe(false)
    })

    it("names the basis of a period not as written in the label of the document evidence, never in a separate item", () => {
        const source = docSourceOf({ title: "Price list" })
        expect(subject.documentEvidenceOf(source, FACT).label).toBe("Price list")
        const dated = { ...FACT, periodNote: "period computed from the document's date 2026-02-20" }
        expect(subject.documentEvidenceOf(source, dated)).toMatchObject({
            kind: "document",
            label: "Price list · period computed from the document's date 2026-02-20",
            quote: FACT.quote,
        })
    })

    it("asks once about a kept truth whose period could not be read, takes a mended answer, and names why in its evidence (D2)", () => {
        // A synthetic laundry: the truth is kept without its period and told; the follow-up that mends the dates loses no line.
        const unclear: ExtractedFact = {
            ...FACT,
            periodUnclear: true,
            periodNote: 'period written "2026-12-24|2026-12-36" is not a calendar day: the truth is filed without a period',
        }
        const first = parsedOf({ facts: [unclear], faults: ["1|x|y => as it is, the truth is kept without its period"] })
        expect(subject.followUpFor(first)).toBe("refused")
        expect(subject.readsBetter(parsedOf({ facts: [FACT] }), first, "refused")).toBe(true)
        expect(subject.readsBetter(first, first, "refused")).toBe(false)
        expect(subject.documentEvidenceOf(docSourceOf({ title: "Laundry hours" }), unclear).label).toBe(
            'Laundry hours · period written "2026-12-24|2026-12-36" is not a calendar day: the truth is filed without a period',
        )
    })
})
