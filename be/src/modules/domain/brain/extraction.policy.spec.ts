import { Test } from "@nestjs/testing"

import { builder } from "@starci/jest-preset"

import {
    MAX_FACTS_PER_DOC,
    MAX_FACTS_PER_WINDOW,
    MAX_WINDOWS,
    PROMPT_VERSION,
    SYSTEM_PROMPT,
    WINDOW_CHARS,
    fieldsOf as realFieldsOf,
    parseFacts as realParseFacts,
    quoteHoldsValue,
    userPrompt as realUserPrompt,
    windowsOf as realWindowsOf,
} from "./extraction.policy"

import type { ExtractedFact } from "./extraction.policy"

const SUBJECT = Symbol("extraction.policy")

const functions = {
    fieldsOf: realFieldsOf,
    parseFacts: realParseFacts,
    userPrompt: realUserPrompt,
    windowsOf: realWindowsOf,
}

const itemOf = builder<Record<string, unknown>>({
    subjectType: "product",
    subjectLabel: "Tea",
    attributeLabel: "Price",
    value: "650,000 VND",
    quote: "Tea costs 650,000 VND",
})

const factOf = builder<ExtractedFact>({
    subjectType: "product",
    subjectLabel: "Tea",
    attributeLabel: "Price",
    value: "650,000 VND",
    unit: null,
    validFrom: null,
    validTo: null,
    scope: "internal",
    quote: "Tea costs 650,000 VND",
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    fieldsOf: realFieldsOf,
                    parseFacts: realParseFacts,
                    userPrompt: realUserPrompt,
                    windowsOf: realWindowsOf,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<typeof functions>(SUBJECT)

    return { subject }
}

describe("extraction policy", () => {
    it("keeps the prompt version and reading limits explicit", () => {
        expect([PROMPT_VERSION, WINDOW_CHARS, MAX_WINDOWS, MAX_FACTS_PER_DOC, MAX_FACTS_PER_WINDOW]).toEqual([
            2, 3500, 40, 200, 40,
        ])
        expect(SYSTEM_PROMPT.split("\n").slice(-1)).toEqual(["At most 40 facts, the most useful first."])
    })

    it("reads tidy windows without overlap and stops at forty windows", async () => {
        const { subject } = await buildSubject()

        expect(subject.windowsOf("  Tea\r\n costs 650,000 VND  ")).toEqual(["Tea\ncosts 650,000 VND"])
        expect(subject.windowsOf(" \n ")).toEqual([])
        const paragraphs = Array.from({ length: 41 }, (_, index) => `${index}: ${"a".repeat(3494)}`)
        expect(subject.windowsOf(paragraphs.join("\n\n"))).toEqual(paragraphs.slice(0, 40))
    })

    it("quotes and bounds the title and names the day and one-based part", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.userPrompt({
                title: `"Tea" ${"x".repeat(160)}`,
                updatedAt: "2026-10-12T10:00:00.000Z",
                index: 1,
                total: 3,
                text: "Tea costs 650,000 VND",
            }),
        ).toBe(
            `Document: "'Tea' ${"x".repeat(154)}"` +
                `\nUpdated: 2026-10-12\nPart 2 of 3\nEXCERPT:\n<<<\nTea costs 650,000 VND\n>>>`,
        )
    })

    it("reads named fields only from non-null objects", async () => {
        const { subject } = await buildSubject()

        expect(subject.fieldsOf({ title: "Tea", count: 3 })).toEqual(
            new Map<string, unknown>([
                ["title", "Tea"],
                ["count", 3],
            ]),
        )
        for (const value of [null, undefined, [], "Tea", 3, true]) expect(subject.fieldsOf(value)).toBeNull()
    })
})

describe("extraction policy parseFacts", () => {
    it("rejects an answer without a facts list and accepts either list shape", async () => {
        const { subject } = await buildSubject()

        for (const answer of [null, undefined, "[]", 3, {}, { facts: null }, { facts: "wrong" }]) {
            expect(subject.parseFacts(answer, "Tea costs 650,000 VND")).toEqual({
                facts: [],
                dropped: 0,
                ungrounded: 0,
                valid: false,
            })
        }
        expect(subject.parseFacts([], "Tea")).toEqual({ facts: [], dropped: 0, ungrounded: 0, valid: true })
        expect(subject.parseFacts({ facts: [itemOf()] }, "Tea costs 650,000 VND")).toEqual({
            facts: [factOf()],
            dropped: 0,
            ungrounded: 0,
            valid: true,
        })
    })

    it("drops nonobjects, empty labels, nonfinite values and duplicates, counting the ungrounded apart", async () => {
        const { subject } = await buildSubject()

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
        expect(subject.parseFacts(items, "Tea costs 650,000 VND")).toEqual({
            facts: [factOf()],
            dropped: 10,
            ungrounded: 2,
            valid: true,
        })
    })

    it("normalizes whitespace, accents and stroked d for grounding and preserves the cleaned fields", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.parseFacts(
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
            ungrounded: 0,
            valid: true,
        })
    })

    it("bounds every text field", async () => {
        const { subject } = await buildSubject()

        const subjectLabel = "s".repeat(161)
        const attributeLabel = "a".repeat(121)
        const quote = `${"q".repeat(60)} 650,000 VND ${"z".repeat(250)}`
        expect(
            subject.parseFacts([itemOf({ subjectLabel, attributeLabel, quote, unit: "u".repeat(21) })], quote),
        ).toEqual({
            facts: [
                factOf({
                    subjectLabel: "s".repeat(160),
                    attributeLabel: "a".repeat(120),
                    unit: "u".repeat(20),
                    quote: `${"q".repeat(60)} 650,000 VND ${"z".repeat(227)}`,
                }),
            ],
            dropped: 0,
            ungrounded: 0,
            valid: true,
        })
    })
})

/** One window of a real-looking shop document (the test document of the BRAIN wave, Vietnamese with its accents). */
const SHOP = [
    "## Gi\u1edd m\u1edf c\u1eeda",
    "- Th\u1ee9 Hai \u0111\u1ebfn Ch\u1ee7 nh\u1eadt: 8:00 \u0111\u1ebfn 20:00.",
    "- Ngh\u1ec9 T\u1ebft B\u00ednh Ng\u1ecd: t\u1eeb 16/02/2026 \u0111\u1ebfn h\u1ebft 20/02/2026, kh\u00f4ng nh\u1eadn \u0111\u01a1n.",
    "## B\u1ea3ng gi\u00e1",
    "- B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng: 350.000 \u0111",
    "- Gi\u1ecf hoa nh\u1ecf: 25.000 \u0111",
    "- Hoa c\u01b0\u1edbi c\u1ea7m tay: 1,2 tri\u1ec7u",
    "## Giao nhanh",
    "Giao nhanh trong 2 gi\u1edd (n\u1ed9i th\u00e0nh): ph\u1ee5 thu 20k m\u1ed7i \u0111\u01a1n.",
    "## Kh\u00e1ch quen",
    "- \u01afu \u0111\u00e3i kh\u00e1ch quen c\u00f3 hi\u1ec7u l\u1ef1c \u0111\u1ebfn 30/06/2026.",
].join("\n")

const ROSES = "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng: 350.000 \u0111"
const BASKET = "Gi\u1ecf hoa nh\u1ecf: 25.000 \u0111"

describe("extraction policy parseFacts: a fact stands on a quote that holds its value (P1)", () => {
    it.each([
        ["the value as written", "350.000 \u0111", ROSES],
        ["another separator and currency", "350,000 VND", ROSES],
        ["a short scale word", "350k", ROSES],
        ["a written-out scale", "350 ngh\u00ecn \u0111\u1ed3ng", ROSES],
        ["millions with a decimal comma", "1.200.000 \u0111", "Hoa c\u01b0\u1edbi c\u1ea7m tay: 1,2 tri\u1ec7u"],
        ["thousands written as k in the text", "20.000 \u0111", "ph\u1ee5 thu 20k m\u1ed7i \u0111\u01a1n"],
        ["a range with another word", "8:00-20:00", "Th\u1ee9 Hai \u0111\u1ebfn Ch\u1ee7 nh\u1eadt: 8:00 \u0111\u1ebfn 20:00."],
        ["a date in ISO form", "2026-06-30", "\u01afu \u0111\u00e3i kh\u00e1ch quen c\u00f3 hi\u1ec7u l\u1ef1c \u0111\u1ebfn 30/06/2026."],
        ["words without accents", "khong nhan don", "Ngh\u1ec9 T\u1ebft B\u00ednh Ng\u1ecd: t\u1eeb 16/02/2026 \u0111\u1ebfn h\u1ebft 20/02/2026, kh\u00f4ng nh\u1eadn \u0111\u01a1n."],
    ])("keeps %s", async (_case, value, quote) => {
        const { subject } = await buildSubject()

        expect(quoteHoldsValue(quote, value)).toBe(true)
        const parsed = subject.parseFacts([itemOf({ value, quote })], SHOP)
        expect([parsed.facts.length, parsed.ungrounded]).toEqual([1, 0])
    })

    it.each([
        ["no quote at all", "350.000 \u0111", undefined],
        ["an empty quote", "350.000 \u0111", " "],
        ["a quote that is not in the window", "350.000 \u0111", "B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 12 b\u00f4ng: 350.000 \u0111"],
        ["a value from ANOTHER line of the window", "25.000 \u0111", ROSES],
        ["a number the quote does not write", "360.000 \u0111", ROSES],
        ["a part of a number only", "35", ROSES],
        ["a word the quote does not say", "giao mi\u1ec5n ph\u00ed", BASKET],
    ])("drops and counts %s", async (_case, value, quote) => {
        const { subject } = await buildSubject()

        const parsed = subject.parseFacts([itemOf({ value, quote })], SHOP)
        expect(parsed).toEqual({ facts: [], dropped: 1, ungrounded: 1, valid: true })
    })

    it("needs every number of the value in the quote, each once", () => {
        expect(quoteHoldsValue("10 b\u00f4ng: 350.000 \u0111", "10 b\u00f4ng 350k")).toBe(true)
        expect(quoteHoldsValue("10 b\u00f4ng: 350.000 \u0111", "10 b\u00f4ng 10 c\u00e0nh")).toBe(false)
        expect(quoteHoldsValue("t\u1eeb 16/02/2026 \u0111\u1ebfn h\u1ebft 20/02/2026", "16/02/2026 - 20/02/2026")).toBe(true)
        expect(quoteHoldsValue("Chuy\u1ec3n kho\u1ea3n tr\u01b0\u1edbc 100%", "100%")).toBe(true)
        expect(quoteHoldsValue("Chuy\u1ec3n kho\u1ea3n tr\u01b0\u1edbc 100%", "10%")).toBe(false)
    })
})

describe("extraction policy parseFacts: dates (P2)", () => {
    it.each([
        [undefined, null],
        [42, null],
        ["tomorrow", null],
        ["2026-13-01", null],
        ["1999-12-31", null],
        ["2101-01-01", null],
        ["2000-01-01", "1999-12-31T17:00:00.000Z"],
        ["2100-12-31", "2100-12-30T17:00:00.000Z"],
    ])("checks a valid-from date of %s", async (validFrom, expected) => {
        const { subject } = await buildSubject()

        expect(subject.parseFacts([itemOf({ validFrom })], "Tea costs 650,000 VND")).toEqual({
            facts: [factOf({ validFrom: expected })],
            dropped: 0,
            ungrounded: 0,
            valid: true,
        })
    })

    it("carries a stated last day as the start of the next day, Vietnam time, so that day is included", async () => {
        const { subject } = await buildSubject()

        const quote = "\u01afu \u0111\u00e3i kh\u00e1ch quen c\u00f3 hi\u1ec7u l\u1ef1c \u0111\u1ebfn 30/06/2026."
        const parsed = subject.parseFacts(
            [itemOf({ subjectLabel: "\u01afu \u0111\u00e3i kh\u00e1ch quen", attributeLabel: "Hi\u1ec7u l\u1ef1c", value: "5%", quote: `${quote} gi\u1ea3m 5%`, validTo: "2026-06-30" })],
            `${SHOP}\n${quote} gi\u1ea3m 5%`,
        )
        expect(parsed.facts.map((fact) => [fact.validFrom, fact.validTo])).toEqual([[null, "2026-06-30T17:00:00.000Z"]])
    })

    it("carries a closed period with both ends", async () => {
        const { subject } = await buildSubject()

        const quote = "Ngh\u1ec9 T\u1ebft B\u00ednh Ng\u1ecd: t\u1eeb 16/02/2026 \u0111\u1ebfn h\u1ebft 20/02/2026, kh\u00f4ng nh\u1eadn \u0111\u01a1n."
        const parsed = subject.parseFacts(
            [itemOf({ value: "kh\u00f4ng nh\u1eadn \u0111\u01a1n", quote, validFrom: "2026-02-16", validTo: "2026-02-20" })],
            SHOP,
        )
        expect(parsed.facts.map((fact) => [fact.validFrom, fact.validTo])).toEqual([
            ["2026-02-15T17:00:00.000Z", "2026-02-20T17:00:00.000Z"],
        ])
    })

    it.each([
        ["no end", undefined, null],
        ["an unreadable end", "soon", null],
        ["an end before the start", "2026-02-10", null],
    ])("keeps the fact without an end for %s", async (_case, validTo, expected) => {
        const { subject } = await buildSubject()

        const parsed = subject.parseFacts([itemOf({ validFrom: "2026-02-16", validTo })], "Tea costs 650,000 VND")
        expect(parsed.facts.map((fact) => fact.validTo)).toEqual([expected])
    })

    it("asks for the end in the prompt, even when it is past", () => {
        expect(SYSTEM_PROMPT).toContain('"validTo":"YYYY-MM-DD" (optional)')
        expect(SYSTEM_PROMPT).toContain("give it even when it is already past")
        expect(SYSTEM_PROMPT).toContain("quote = REQUIRED")
    })

    it("stops at forty kept facts while counting every omitted item", async () => {
        const { subject } = await buildSubject()

        const items = Array.from({ length: 42 }, (_, index) => itemOf({ subjectLabel: `Tea ${index}` }))
        expect(subject.parseFacts(items, "Tea costs 650,000 VND")).toEqual({
            facts: Array.from({ length: 40 }, (_, index) => factOf({ subjectLabel: `Tea ${index}` })),
            dropped: 2,
            ungrounded: 0,
            valid: true,
        })
    })
})
