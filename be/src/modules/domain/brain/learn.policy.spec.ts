import { Test } from "@nestjs/testing"

import { builder } from "@starci/jest-preset"

import type { Correction } from "./brain.contracts"

import {
    LEARN_SYSTEM,
    MIN_CORRECTIONS,
    describe as realDescribe,
    learnPrompt as realLearnPrompt,
    parseLessons as realParseLessons,
} from "./learn.policy"

const SUBJECT = Symbol("learn.policy")

const functions = { describe: realDescribe, learnPrompt: realLearnPrompt, parseLessons: realParseLessons }

const correctionOf = builder<Correction>({
    decisionId: "d1",
    action: "reply",
    outcome: "edited",
    note: null,
    at: "2026-10-12T10:00:00.000Z",
    before: null,
    after: null,
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { describe: realDescribe, learnPrompt: realLearnPrompt, parseLessons: realParseLessons },
            },
        ],
    }).compile()
    const subject = moduleRef.get<typeof functions>(SUBJECT)

    return { subject }
}

describe("learn policy", () => {
    it("requires three corrections and names the JSON response contract", () => {
        expect(MIN_CORRECTIONS).toBe(3)
        expect(LEARN_SYSTEM.split("\n").slice(-1)).toEqual([
            'Reply with ONLY JSON: {"lessons": [{"title": string (max 12 words), "body": ' +
                'string (max 60 words), "applies_when": string (max 20 words), "decisions": ' +
                "string[] (the ids it is based on, at least 2)}]} with at most 5 lessons, or " +
                '{"lessons": []}.',
        ])
    })
})

describe("learn policy describe", () => {
    it("describes an edited draft and changed fields with the owner's note", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.describe(
                correctionOf({
                    before: { draft: "Hello", fields: { price: 10, unchanged: true, removed: "old" } },
                    after: { draft: "Welcome", fields: { price: 12, unchanged: true, added: "new" } },
                    note: "Use the new price",
                }),
            ),
        ).toBe(
            "Action: reply · edited\nAI draft: Hello\nOwner's version: Welcome\nField price: 10 " +
                '-> 12\nField removed: "old" -> null\nField added: null -> "new"\nOwner\'s note: Use ' +
                "the new price",
        )
    })

    it("describes absent bodies and does not invent a draft", async () => {
        const { subject } = await buildSubject()

        expect(subject.describe(correctionOf())).toBe("Action: reply · edited")
        expect(subject.describe(correctionOf({ before: {}, after: { draft: "Welcome" } }))).toBe(
            "Action: reply · edited",
        )
    })

    it("keeps only the AI draft for rejected, unchanged or incomplete edits", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.describe(
                correctionOf({ outcome: "rejected", before: { draft: "Hello" }, after: { draft: "Welcome" } }),
            ),
        ).toBe("Action: reply · rejected\nAI draft: Hello")
        expect(subject.describe(correctionOf({ before: { draft: "Hello" }, after: { draft: "Hello" } }))).toBe(
            "Action: reply · edited\nAI draft: Hello",
        )
        expect(subject.describe(correctionOf({ before: { draft: "Hello" }, after: {} }))).toBe(
            "Action: reply · edited\nAI draft: Hello",
        )
    })

    it("skips empty drafts and notes while retaining whitespace text", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.describe(correctionOf({ before: { draft: "" }, after: { draft: "Owner version" }, note: "" })),
        ).toBe("Action: reply · edited")
        expect(subject.describe(correctionOf({ before: { draft: "AI draft" }, after: { draft: "" } }))).toBe(
            "Action: reply · edited\nAI draft: AI draft",
        )
        expect(subject.describe(correctionOf({ before: { draft: " " }, after: { draft: "  " }, note: " " }))).toBe(
            "Action: reply · edited\nAI draft:  \nOwner's version:   \nOwner's note:  ",
        )
    })

    it("clips long drafts, fields and notes with their exact ellipses", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.describe(
                correctionOf({
                    before: { draft: "a".repeat(601), fields: { text: "b".repeat(130) } },
                    after: { draft: "c".repeat(601), fields: { text: "d".repeat(130) } },
                    note: "e".repeat(301),
                }),
            ),
        ).toBe(
            `Action: reply · edited` +
                `\nAI draft: ${"a".repeat(599)}…` +
                `\nOwner's version: ${"c".repeat(599)}…` +
                `\nField text: "${"b".repeat(118)}… -> "${"d".repeat(118)}…` +
                `\nOwner's note: ${"e".repeat(299)}…`,
        )
    })
})

describe("learn policy describe", () => {
    it("keeps text at each clipping boundary and compares missing fields as null", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.describe(
                correctionOf({
                    before: { draft: "a".repeat(600), fields: { text: "b".repeat(118), empty: undefined } },
                    after: { fields: { empty: null } },
                    note: "c".repeat(300),
                }),
            ),
        ).toBe(
            `Action: reply · edited` +
                `\nAI draft: ${"a".repeat(600)}` +
                `\nField text: "${"b".repeat(118)}" -> null` +
                `\nOwner's note: ${"c".repeat(300)}`,
        )
        expect(subject.describe(correctionOf({ after: { fields: { price: 10 } } }))).toBe(
            "Action: reply · edited\nField price: null -> 10",
        )
        expect(subject.describe(correctionOf({ before: { fields: { price: 10 } } }))).toBe(
            "Action: reply · edited\nField price: 10 -> null",
        )
    })
})

describe("learn policy", () => {
    it("lists existing lessons and corrections in their given order", async () => {
        const { subject } = await buildSubject()

        expect(subject.learnPrompt([], [])).toBe("EXISTING LESSONS:\n(none)\n\nCORRECTIONS (newest first):\n")
        expect(
            subject.learnPrompt(
                ["Use the new price", "Be brief"],
                [correctionOf({ decisionId: "d2" }), correctionOf({ outcome: "rejected" })],
            ),
        ).toBe(
            "EXISTING LESSONS:\nUse the new price\nBe brief\n\nCORRECTIONS (newest " +
                "first):\n[d2]\nAction: reply · edited\n\n[d1]\nAction: reply · rejected",
        )
    })
})

describe("learn policy parseLessons", () => {
    it("rejects answers without a lessons array", async () => {
        const { subject } = await buildSubject()

        for (const answer of [null, undefined, [], {}, { lessons: "wrong" }])
            expect(subject.parseLessons(answer)).toEqual([])
    })

    it("drops nonobjects and lessons without string titles or bodies", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.parseLessons({
                lessons: [null, [], {}, { title: 42, body: "Text" }, { title: "Title", body: 42 }],
            }),
        ).toEqual([])
    })

    it("keeps text fields and string decision ids with defaults for missing fields", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.parseLessons({
                lessons: [
                    {
                        title: "Price",
                        body: "Use the latest price",
                        applies_when: "Quoting",
                        decisions: ["d1", 2, "d2", null],
                    },
                    { title: "Brief", body: "Be brief" },
                    { title: "Tone", body: "Be friendly", applies_when: 42, decisions: "d3" },
                ],
            }),
        ).toEqual([
            { title: "Price", body: "Use the latest price", appliesWhen: "Quoting", decisions: ["d1", "d2"] },
            { title: "Brief", body: "Be brief", appliesWhen: "", decisions: [] },
            { title: "Tone", body: "Be friendly", appliesWhen: "", decisions: [] },
        ])
    })
})
