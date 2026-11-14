import { Test } from "@nestjs/testing"
import type { Evidence } from "./brain-facts.contracts"
import {
    EVIDENCE_MAX,
    mergeEvidence,
    normalFact,
    shopInstantOf,
    unitFormOf,
    valueLineOf,
} from "./fact-input.policy"

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

describe("the one normal form of a value and its unit (D-T5-1)", () => {
    it.each([
        // The live case: Sales filed "32.000 d mot don" with unit "d"; the card read "... -> 32.000 d mot don d".
        [
            "32.000 \u0111 m\u1ed9t \u0111\u01a1n",
            "\u0111",
            { value: "32.000 \u0111 m\u1ed9t \u0111\u01a1n", unit: null },
        ],
        ["30.000 \u0111", "\u0111", { value: "30.000", unit: "\u0111" }],
        ["30.000\u0111", " \u0111 ", { value: "30.000", unit: "\u0111" }],
        ["30.000", "\u0111", { value: "30.000", unit: "\u0111" }],
        ["\u0110\u01a1n t\u1eeb 500.000 \u0111", "\u0111", { value: "\u0110\u01a1n t\u1eeb 500.000", unit: "\u0111" }],
        [
            "trong 7 ng\u00e0y sau khi nh\u1eadn h\u00e0ng",
            "ng\u00e0y",
            { value: "trong 7 ng\u00e0y sau khi nh\u1eadn h\u00e0ng", unit: null },
        ],
        ["12.000\u0111", "c\u00e0nh", { value: "12.000\u0111", unit: "c\u00e0nh" }],
        [
            "giao trong ng\u00e0y, \u0111\u01a1n tr\u00ean 2 \u0111\u01a1n",
            "\u0111",
            { value: "giao trong ng\u00e0y, \u0111\u01a1n tr\u00ean 2 \u0111\u01a1n", unit: "\u0111" },
        ],
        ["5 KG", "kg", { value: "5", unit: "kg" }],
        [" 30.000 \u0111 m\u1ed9t \u0111\u01a1n ", null, { value: "30.000 \u0111 m\u1ed9t \u0111\u01a1n", unit: null }],
        ["30.000", "  ", { value: "30.000", unit: null }],
        ["\u0111", "\u0111", { value: "\u0111", unit: null }],
        [
            "20.000 \u0111 ho\u1eb7c 30.000 \u0111",
            "\u0111",
            { value: "20.000 \u0111 ho\u1eb7c 30.000 \u0111", unit: null },
        ],
    ])("%j with unit %j is kept as %j", (value, unit, form) => {
        expect(unitFormOf({ value, unit })).toEqual(form)
    })

    it("reads a value with its unit once, whichever form it was stored in", () => {
        expect(valueLineOf({ value: "32.000 \u0111 m\u1ed9t \u0111\u01a1n", unit: "\u0111" })).toBe(
            "32.000 \u0111 m\u1ed9t \u0111\u01a1n",
        )
        expect(valueLineOf({ value: "32.000", unit: "\u0111" })).toBe("32.000 \u0111")
        expect(valueLineOf({ value: "32.000 \u0111", unit: "\u0111" })).toBe("32.000 \u0111")
        expect(valueLineOf({ value: "M\u1edf c\u1eeda 8h", unit: null })).toBe("M\u1edf c\u1eeda 8h")
    })
})

describe("fact-input.policy: a date means the start of that day in the shop's clock (D-BR-16)", () => {
    it.each([
        // The walk's A6: saveBrainFact validFrom "2026-12-01" was stored as 00:00Z (07:00 in the shop).
        ["2026-12-01", "2026-11-30T17:00:00.000Z"],
        [" 2027-02-12 ", "2027-02-11T17:00:00.000Z"],
        ["2026-12-01T00:00:00+07:00", "2026-12-01T00:00:00+07:00"],
        ["2026-12-01T10:06:00.000Z", "2026-12-01T10:06:00.000Z"],
    ])("reads %s as %s", (stated, instant) => {
        expect(shopInstantOf(stated, "Asia/Ho_Chi_Minh")).toBe(instant)
    })

    it("keeps an absent bound absent", () => {
        expect([shopInstantOf(null, "Asia/Ho_Chi_Minh"), shopInstantOf(undefined, "Asia/Ho_Chi_Minh")]).toEqual([null, undefined])
    })

    it.each([
        ["2026-12-01", "Europe/London", "2026-12-01T00:00:00.000Z"],
        ["2026-07-01", "Europe/London", "2026-06-30T23:00:00.000Z"],
        ["2026-12-01", "America/New_York", "2026-12-01T05:00:00.000Z"],
    ])("reads %s in the workspace's zone %s as %s", (stated, zone, instant) => {
        expect(shopInstantOf(stated, zone)).toBe(instant)
    })
})
