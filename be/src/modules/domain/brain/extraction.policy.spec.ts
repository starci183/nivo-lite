import { builder } from "@starci/jest-preset"
import {
    MAX_FACTS_PER_DOC,
    MAX_FACTS_PER_WINDOW,
    MAX_WINDOWS,
    PROMPT_VERSION,
    SYSTEM_PROMPT,
    WINDOW_CHARS,
    fieldsOf,
    parseFacts,
    userPrompt,
    windowsOf,
} from "./extraction.policy"
import type { ExtractedFact } from "./extraction.policy"

const itemOf = builder<Record<string, unknown>>({
    subjectType: "product",
    subjectLabel: "Tea",
    attributeLabel: "Price",
    value: "650,000 VND",
})

const factOf = builder<ExtractedFact>({
    subjectType: "product",
    subjectLabel: "Tea",
    attributeLabel: "Price",
    value: "650,000 VND",
    unit: null,
    validFrom: null,
    scope: "internal",
    quote: null,
})

describe("extraction policy", () => {
    it("keeps the prompt version and reading limits explicit", () => {
        expect([PROMPT_VERSION, WINDOW_CHARS, MAX_WINDOWS, MAX_FACTS_PER_DOC, MAX_FACTS_PER_WINDOW]).toEqual([
            1, 3500, 40, 200, 40,
        ])
        expect(SYSTEM_PROMPT.split("\n").slice(-1)).toEqual(["At most 40 facts, the most useful first."])
    })

    it("reads tidy windows without overlap and stops at forty windows", () => {
        expect(windowsOf("  Tea\r\n costs 650,000 VND  ")).toEqual(["Tea\ncosts 650,000 VND"])
        expect(windowsOf(" \n ")).toEqual([])
        const paragraphs = Array.from({ length: 41 }, (_, index) => `${index}: ${"a".repeat(3494)}`)
        expect(windowsOf(paragraphs.join("\n\n"))).toEqual(paragraphs.slice(0, 40))
    })

    it("quotes and bounds the title and names the day and one-based part", () => {
        expect(
            userPrompt({
                title: `"Tea" ${"x".repeat(160)}`,
                updatedAt: "2026-10-12T10:00:00.000Z",
                index: 1,
                total: 3,
                text: "Tea costs 650,000 VND",
            }),
        ).toBe(
            `Document: "'Tea' ${"x".repeat(154)}"\nUpdated: 2026-10-12\nPart 2 of 3\nEXCERPT:\n<<<\nTea costs 650,000 VND\n>>>`,
        )
    })

    it("reads named fields only from non-null objects", () => {
        expect(fieldsOf({ title: "Tea", count: 3 })).toEqual(
            new Map<string, unknown>([
                ["title", "Tea"],
                ["count", 3],
            ]),
        )
        for (const value of [null, undefined, [], "Tea", 3, true]) expect(fieldsOf(value)).toBeNull()
    })

    describe("parseFacts", () => {
        it("rejects an answer without a facts list and accepts either list shape", () => {
            for (const answer of [null, undefined, "[]", 3, {}, { facts: null }, { facts: "wrong" }]) {
                expect(parseFacts(answer, "Tea costs 650,000 VND")).toEqual({ facts: [], dropped: 0, valid: false })
            }
            expect(parseFacts([], "Tea")).toEqual({ facts: [], dropped: 0, valid: true })
            expect(parseFacts({ facts: [itemOf()] }, "Tea costs 650,000 VND")).toEqual({
                facts: [factOf()],
                dropped: 0,
                valid: true,
            })
        })

        it("drops nonobjects, empty labels, nonfinite or nongrounded values and duplicates", () => {
            const items = [
                null,
                [],
                itemOf({ subjectLabel: "!" }),
                itemOf({ attributeLabel: " " }),
                itemOf({ value: "!?" }),
                itemOf({ value: Number.POSITIVE_INFINITY }),
                itemOf({ value: true }),
                itemOf({ value: "unknown", quote: "" }),
                itemOf({ value: "xy", quote: "no" }),
                itemOf(),
                itemOf({ subjectLabel: "TEA", attributeLabel: "PRICE", value: "650 000 vnd" }),
            ]
            expect(parseFacts(items, "Tea costs 650,000 VND")).toEqual({ facts: [factOf()], dropped: 10, valid: true })
        })

        it("normalizes whitespace, accents and stroked d for grounding and preserves the cleaned fields", () => {
            expect(
                parseFacts(
                    [
                        itemOf({
                            subjectType: " PRODUCT ",
                            subjectLabel: "  Tr\u00e0\n \u0111\u1ecf  ",
                            attributeLabel: "  Gi\u00e1\t b\u00e1n ",
                            unit: " VND ",
                            validFrom: " 2026-10-12T12:00:00Z ",
                            scope: "public",
                            quote: " Tr\u00e0\n\u0111\u1ecf: 650,000 VND ",
                        }),
                    ],
                    "TRA DO: 650,000 VND",
                ),
            ).toEqual({
                facts: [
                    factOf({
                        subjectLabel: "Tr\u00e0 \u0111\u1ecf",
                        attributeLabel: "Gi\u00e1 b\u00e1n",
                        unit: "VND",
                        validFrom: "2026-10-11T17:00:00.000Z",
                        scope: "public",
                        quote: "Tr\u00e0 \u0111\u1ecf: 650,000 VND",
                    }),
                ],
                dropped: 0,
                valid: true,
            })
        })

        it("accepts compact numeric grounding and finite numeric fields", () => {
            expect(
                parseFacts(
                    [itemOf({ subjectType: 42, subjectLabel: 12, attributeLabel: 34, value: 650000, unit: 7 })],
                    "650.000",
                ),
            ).toEqual({
                facts: [
                    factOf({
                        subjectType: "other",
                        subjectLabel: "12",
                        attributeLabel: "34",
                        value: "650000",
                        unit: "7",
                    }),
                ],
                dropped: 0,
                valid: true,
            })
        })

        it("accepts a grounded quote even when the value is absent and rejects a quote absent from the text", () => {
            expect(parseFacts([itemOf({ value: "missing", quote: "Tea costs" })], "Tea costs more")).toEqual({
                facts: [factOf({ value: "missing", quote: "Tea costs" })],
                dropped: 0,
                valid: true,
            })
            expect(parseFacts([itemOf({ quote: "another excerpt", subjectType: "unknown" })], "650,000 VND")).toEqual({
                facts: [factOf({ subjectType: "other" })],
                dropped: 0,
                valid: true,
            })
        })

        it("bounds every text field and checks only the first sixty folded quote characters", () => {
            const subjectLabel = "s".repeat(161)
            const attributeLabel = "a".repeat(121)
            const value = "v".repeat(501)
            const quote = `${"q".repeat(60)} ${"z".repeat(250)}`
            expect(
                parseFacts(
                    [itemOf({ subjectLabel, attributeLabel, value, quote, unit: "u".repeat(21) })],
                    "q".repeat(60),
                ),
            ).toEqual({
                facts: [
                    factOf({
                        subjectLabel: "s".repeat(160),
                        attributeLabel: "a".repeat(120),
                        value: "v".repeat(500),
                        unit: "u".repeat(20),
                        quote: `${"q".repeat(60)} ${"z".repeat(239)}`,
                    }),
                ],
                dropped: 0,
                valid: true,
            })
        })

        it.each([
            [undefined, null],
            [42, null],
            ["tomorrow", null],
            ["2026-13-01", null],
            ["1999-12-31", null],
            ["2101-01-01", null],
            ["2000-01-01", "1999-12-31T17:00:00.000Z"],
            ["2100-12-31", "2100-12-30T17:00:00.000Z"],
        ])("checks a valid-from date of %s", (validFrom, expected) => {
            expect(parseFacts([itemOf({ validFrom })], "650,000 VND")).toEqual({
                facts: [factOf({ validFrom: expected })],
                dropped: 0,
                valid: true,
            })
        })

        it("stops at forty kept facts while counting every omitted item", () => {
            const items = Array.from({ length: 42 }, (_, index) => itemOf({ subjectLabel: `Tea ${index}` }))
            expect(parseFacts(items, "650,000 VND")).toEqual({
                facts: Array.from({ length: 40 }, (_, index) => factOf({ subjectLabel: `Tea ${index}` })),
                dropped: 2,
                valid: true,
            })
        })
    })
})
