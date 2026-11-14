import { Test } from "@nestjs/testing"
import { MAX_SHOWN_CHARS, shownSourcesOf } from "./draft-sources.policy"
import type { InternalText } from "./public-documents.contracts"

const SUBJECT = Symbol("draft-sources.policy")
interface Subject {
    shownSourcesOf: typeof shownSourcesOf
}
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { shownSourcesOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** A laundry's public document (synthetic data). */
const textOf = (sourceId: string, text: string): InternalText => ({ sourceId, title: `Doc ${sourceId}`, contentHash: "h", text })

describe("shownSourcesOf", () => {
    it("shows a text within its share whole, trimmed, and not cut", async () => {
        const subject = await buildSubject()

        expect(subject.shownSourcesOf([textOf("s1", "  Wash and fold in 24 hours.\n")])).toEqual([
            { sourceId: "s1", title: "Doc s1", text: "Wash and fold in 24 hours.", cut: false },
        ])
    })

    it("gives each source an equal share of the call's bound and cuts a longer text at a space", async () => {
        const subject = await buildSubject()
        const long = "iron ".repeat(MAX_SHOWN_CHARS / 2)

        const [first, second] = subject.shownSourcesOf([textOf("s1", long), textOf("s2", "Dry cleaning in two days.")])

        expect(first?.cut).toBe(true)
        expect(first?.text.length).toBeLessThanOrEqual(MAX_SHOWN_CHARS / 2)
        expect(first?.text.endsWith("iron")).toBe(true)
        expect(second).toEqual({ sourceId: "s2", title: "Doc s2", text: "Dry cleaning in two days.", cut: false })
    })

    it("cuts a text with no space exactly at the share", async () => {
        const subject = await buildSubject()

        const [shown] = subject.shownSourcesOf([textOf("s1", "x".repeat(MAX_SHOWN_CHARS + 10))])

        expect(shown?.text).toHaveLength(MAX_SHOWN_CHARS)
        expect(shown?.cut).toBe(true)
    })

    it("shows nothing for no source", async () => {
        const subject = await buildSubject()

        expect(subject.shownSourcesOf([])).toEqual([])
    })
})
