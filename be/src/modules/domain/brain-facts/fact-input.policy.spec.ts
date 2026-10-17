import { Test } from "@nestjs/testing"
import type { Evidence } from "./brain-facts.contracts"
import { EVIDENCE_MAX, mergeEvidence, normalFact } from "./fact-input.policy"

type Subject = {
    normalFact: typeof normalFact
    mergeEvidence: typeof mergeEvidence
}

const SUBJECT = Symbol("fact-input.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { normalFact, mergeEvidence } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("fact inputs", () => {
    it("trims labels and values and returns normalized keys and the numeric value", async () => {
        const subject = await build()

        expect(
            subject.normalFact({
                subjectLabel: "  Combo Th\u01b0 gi\u00e3n  ",
                attributeLabel: "  Gi\u00e1  ",
                value: "  1,2 tr  ",
            }),
        ).toEqual({
            subjectLabel: "Combo Th\u01b0 gi\u00e3n",
            attributeLabel: "Gi\u00e1",
            value: "1,2 tr",
            subjectKey: "combo-thu-gian",
            attribute: "gia",
            valueNumber: 1200000,
        })
    })

    it("bounds all labels and the value", async () => {
        const subject = await build()

        expect(
            subject.normalFact({
                subjectLabel: "S".repeat(170),
                attributeLabel: "A".repeat(130),
                value: "v".repeat(2010),
            }),
        ).toEqual({
            subjectLabel: "S".repeat(160),
            attributeLabel: "A".repeat(120),
            value: "v".repeat(2000),
            subjectKey: "s".repeat(120),
            attribute: "a".repeat(120),
            valueNumber: null,
        })
    })

    it.each([
        { subjectLabel: "???", attributeLabel: "price", value: "8" },
        { subjectLabel: "combo", attributeLabel: "???", value: "8" },
        { subjectLabel: "combo", attributeLabel: "price", value: "   " },
    ])("rejects an input lacking a usable subject, attribute or value: %j", async (input) => {
        const subject = await build()

        expect(subject.normalFact(input)).toBeNull()
    })

    it("keeps existing evidence and adds only new kind and reference pairs", async () => {
        const subject = await build()

        const have: Array<Evidence> = [{ kind: "note", ref: "n1", label: "Original" }]
        const add: Array<Evidence> = [
            { kind: "note", ref: "n1", label: "Repeated" },
            { kind: "document", ref: "n1", label: "Document" },
            { kind: "note", ref: "n2", label: "New note" },
        ]

        expect(subject.mergeEvidence(have, add)).toEqual([
            { kind: "note", ref: "n1", label: "Original" },
            { kind: "document", ref: "n1", label: "Document" },
            { kind: "note", ref: "n2", label: "New note" },
        ])
        expect(have).toEqual([{ kind: "note", ref: "n1", label: "Original" }])
        expect(add).toEqual([
            { kind: "note", ref: "n1", label: "Repeated" },
            { kind: "document", ref: "n1", label: "Document" },
            { kind: "note", ref: "n2", label: "New note" },
        ])
    })
})

describe("fact inputs", () => {
    it("keeps exactly the newest twenty pieces of evidence", async () => {
        const subject = await build()

        const have: Array<Evidence> = Array.from({ length: 20 }, (_, index) => ({
            kind: "note",
            ref: `n${index}`,
            label: `Note ${index}`,
        }))
        const add: Array<Evidence> = [{ kind: "note", ref: "n20", label: "Note 20" }]

        expect(EVIDENCE_MAX).toBe(20)
        expect(subject.mergeEvidence(have, add)).toEqual([
            { kind: "note", ref: "n1", label: "Note 1" },
            { kind: "note", ref: "n2", label: "Note 2" },
            { kind: "note", ref: "n3", label: "Note 3" },
            { kind: "note", ref: "n4", label: "Note 4" },
            { kind: "note", ref: "n5", label: "Note 5" },
            { kind: "note", ref: "n6", label: "Note 6" },
            { kind: "note", ref: "n7", label: "Note 7" },
            { kind: "note", ref: "n8", label: "Note 8" },
            { kind: "note", ref: "n9", label: "Note 9" },
            { kind: "note", ref: "n10", label: "Note 10" },
            { kind: "note", ref: "n11", label: "Note 11" },
            { kind: "note", ref: "n12", label: "Note 12" },
            { kind: "note", ref: "n13", label: "Note 13" },
            { kind: "note", ref: "n14", label: "Note 14" },
            { kind: "note", ref: "n15", label: "Note 15" },
            { kind: "note", ref: "n16", label: "Note 16" },
            { kind: "note", ref: "n17", label: "Note 17" },
            { kind: "note", ref: "n18", label: "Note 18" },
            { kind: "note", ref: "n19", label: "Note 19" },
            { kind: "note", ref: "n20", label: "Note 20" },
        ])
        expect(subject.mergeEvidence([], [])).toEqual([])
    })
})
