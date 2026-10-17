import { Test } from "@nestjs/testing"
import { CHUNK_OVERLAP, CHUNK_SIZE, chunkText, normalizeText } from "./chunk.policy"

type Subject = {
    normalizeText: typeof normalizeText
    chunkText: typeof chunkText
}

const words = (count: number): string => Array.from({ length: count }, (_, index) => `w${index}`).join(" ")

const SUBJECT = Symbol("chunk.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { normalizeText, chunkText } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("normalizeText", () => {
    it("composes Vietnamese to NFC so the same letter typed two ways is one thing", async () => {
        const subject = await buildSubject()

        expect(subject.normalizeText("e\u0301")).toBe("\u00e9")
    })

    it("uses one newline style and drops control, zero-width and soft-hyphen characters", async () => {
        const subject = await buildSubject()

        expect(subject.normalizeText("a\r\nb\rc\u2028d\u2029e\u0001f\u200bg\u00adh")).toBe("a\nb\nc\nd\nefgh")
    })

    it("turns exotic spaces into spaces and collapses them", async () => {
        const subject = await buildSubject()

        expect(subject.normalizeText("a\u00a0\u00a0 b\t\tc \n d")).toBe("a b c\nd")
    })

    it("shortens long runs of dots and dashes and keeps at most one blank line", async () => {
        const subject = await buildSubject()

        expect(subject.normalizeText("wait.......\n\n\n\nend----------")).toBe("wait...\n\nend---")
    })
})

describe("chunkText", () => {
    it("answers nothing for empty text", async () => {
        const subject = await buildSubject()

        expect(subject.chunkText("")).toEqual([])
        expect(subject.chunkText("  \n\n \t ")).toEqual([])
    })

    it("keeps a short text as one passage", async () => {
        const subject = await buildSubject()

        expect(subject.chunkText("Opening hours: 8 to 21.")).toEqual(["Opening hours: 8 to 21."])
    })

    it("uses the documented default sizes", () => {
        expect(CHUNK_SIZE).toBe(800)
        expect(CHUNK_OVERLAP).toBe(120)
    })

    it("packs paragraphs up to the size and starts each later passage with the tail of the previous one", async () => {
        const subject = await buildSubject()

        const first = "alpha beta gamma delta epsilon zeta eta theta iota kappa"
        const second = "lambda mu nu xi omicron pi rho sigma tau upsilon phi chi"
        const third = "one two three four five six seven eight nine ten eleven"

        const passages = subject.chunkText(`${first}\n\n${second}\n\n${third}`, 70, 30)

        expect(passages).toEqual([
            first,
            `${first.slice(-30).slice(first.slice(-30).indexOf(" ") + 1)}\n${second}`,
            `${second.slice(-30).slice(second.slice(-30).indexOf(" ") + 1)}\n${third}`,
        ])
    })

    it("joins small paragraphs into one passage while they fit", async () => {
        const subject = await buildSubject()

        expect(subject.chunkText("first line\n\nsecond line\n\nthird line", 100)).toEqual([
            "first line\n\nsecond line\n\nthird line",
        ])
    })

    it("adds no overlap when the overlap is zero", async () => {
        const subject = await buildSubject()

        const passages = subject.chunkText(`${"a".repeat(60)}\n\n${"b".repeat(60)}`, 70, 0)

        expect(passages).toEqual(["a".repeat(60), "b".repeat(60)])
    })

    it("keeps the whole tail when it has no usable space", async () => {
        const subject = await buildSubject()

        const passages = subject.chunkText(`${"a".repeat(60)}\n\n${"b".repeat(60)}`, 70, 20)

        expect(passages).toEqual(["a".repeat(60), `${"a".repeat(20)}\n${"b".repeat(60)}`])
    })

    it("cuts an over-long block after a sentence end when one is in reach", async () => {
        const subject = await buildSubject()

        const passages = subject.chunkText(`This sentence is the first one. ${words(20)}`, 60, 0)

        expect(passages[0]).toBe("This sentence is the first one.")
        expect(passages.every((passage) => passage.length <= 60)).toBe(true)
    })
})

describe("chunkText", () => {
    it("cuts an over-long block at a space when no sentence end is in reach", async () => {
        const subject = await buildSubject()

        const passages = subject.chunkText(words(40), 50, 0)

        expect(passages).toHaveLength(4)
        expect(passages.every((passage) => passage.length <= 50)).toBe(true)
        expect(passages.join(" ")).toBe(words(40))
    })

    it("cuts a block with no space anywhere at the size without splitting a surrogate pair", async () => {
        const subject = await buildSubject()

        const text = `${"a".repeat(9)}\u{1f600}${"b".repeat(30)}`

        const passages = subject.chunkText(text, 10, 0)

        expect(passages[0]).toBe("a".repeat(9))
        expect(passages[1]?.startsWith("\u{1f600}")).toBe(true)
    })
})

describe("chunkText", () => {
    it("cuts a block with no space at the size when the cut is clean", async () => {
        const subject = await buildSubject()

        expect(subject.chunkText("a".repeat(25), 10, 0)).toEqual(["a".repeat(10), "a".repeat(5)])
    })

    it("keeps a repeated long paragraph once and a repeated short one every time", async () => {
        const subject = await buildSubject()

        const footer = "Contact us any time at the front desk, thank you."

        expect(subject.chunkText(`${footer}\n\nOK\n\n${footer}\n\nOK`, 100, 0)).toEqual([`${footer}\n\nOK\n\nOK`])
    })

    it("keeps a long block with no letters or digits every time it repeats in the text", async () => {
        const subject = await buildSubject()

        const marks = "?!".repeat(20)

        expect(subject.chunkText(`${marks}\n\nsome words here\n\n${marks}`, 60, 0)).toEqual([
            `${marks}\n\nsome words here`,
            marks,
        ])
    })

    it("de-duplicates passages made only of punctuation by their raw text", async () => {
        const subject = await buildSubject()

        const marks = "?!".repeat(20)

        expect(subject.chunkText(`${marks}\n\nsome words here\n\n${marks}`, 45, 0)).toEqual([marks, "some words here"])
    })
})

describe("chunkText", () => {
    describe("tables", () => {
        it("cuts a table by rows and repeats its header in every passage", async () => {
            const subject = await buildSubject()

            const header = "name,price,unit"
            const rows = Array.from({ length: 12 }, (_, index) => `item${index},${index}000,cup`)

            const passages = subject.chunkText([header, ...rows].join("\n"), 130, 0)

            expect(passages.length).toBeGreaterThan(1)
            expect(passages.every((passage) => passage.startsWith(`${header}\n`))).toBe(true)
            expect(passages.join("\n")).toContain("item11,11000,cup")
        })

        it.each([
            ["a pipe", "a|b\nc|d\ne|f"],
            ["a semicolon", "a;b\nc;d\ne;f"],
            ["two commas", "a,b,c\nd,e,f\ng,h,i"],
        ])("recognises a table separated by %s", async (_name, text) => {
            const subject = await buildSubject()

            expect(subject.chunkText(text, 100, 0)).toEqual([text])
        })

        it("does not take a single comma per line for a table", async () => {
            const subject = await buildSubject()

            expect(subject.chunkText("a, b\nc, d\ne, f", 100, 0)).toEqual(["a, b\nc, d\ne, f"])
        })

        it("does not take fewer than three lines for a table", async () => {
            const subject = await buildSubject()

            expect(subject.chunkText("a|b\nc|d", 100, 0)).toEqual(["a|b\nc|d"])
        })

        it("does not take a block where few lines carry the delimiter for a table", async () => {
            const subject = await buildSubject()

            const text = "a|b\nplain\nplain too\nplain again"

            expect(subject.chunkText(text, 100, 0)).toEqual([text])
        })

        it.each([
            ["the larger count first", "a|b|c\nd|e|f\ng|h\ni|j"],
            ["the smaller count first", "a|b\nc|d\ne|f|g\nh|i|j"],
        ])(
            "does not take a block whose lines split evenly between two counts (%s) for a table",
            async (_name, text) => {
                const subject = await buildSubject()

                expect(subject.chunkText(text, 100, 0)).toEqual([text])
            },
        )

        it("drops duplicate rows and separator rows", async () => {
            const subject = await buildSubject()

            const text = "name|price\n---|---\nlatte|40\nlatte|40\nmocha|45"

            expect(subject.chunkText(text, 100, 0)).toEqual(["name|price\nlatte|40\nmocha|45"])
        })

        it("keeps rows that hold no letters or digits every time they repeat", async () => {
            const subject = await buildSubject()

            const text = "name|price\n,|,\n,|,\nlatte|40"

            expect(subject.chunkText(text, 100, 0)).toEqual(["name|price\n,|,\n,|,\nlatte|40"])
        })
    })
})

describe("chunkText", () => {
    describe("tables", () => {
        it("answers a header-only table as its header", async () => {
            const subject = await buildSubject()

            expect(subject.chunkText("name|price\n---|---\n---|---", 100, 0)).toEqual(["name|price"])
        })

        it("answers nothing for a table made only of separators", async () => {
            const subject = await buildSubject()

            expect(subject.chunkText("|-|-|\n|-|-|\n|-|-|", 100, 0)).toEqual([])
        })

        it("drops the header when it is longer than half the size", async () => {
            const subject = await buildSubject()

            const header = `${"h".repeat(60)}|x`
            const text = `${header}\nrow1|a\nrow2|b`

            expect(subject.chunkText(text, 100, 0)).toEqual([`${header}\nrow1|a\nrow2|b`])
        })
    })
})

describe("chunkText", () => {
    describe("tables", () => {
        it("splits a row longer than the room of a passage", async () => {
            const subject = await buildSubject()

            const row = `${words(60)}|end`
            const text = `head|tail\n${row}\nsmall|row\nsmall|two`

            const passages = subject.chunkText(text, 150, 0)

            expect(passages.length).toBeGreaterThan(1)
            expect(passages.join("\n")).toContain("small|two")
        })

        it("keeps a table apart from the prose around it and gives it no overlap", async () => {
            const subject = await buildSubject()

            const text =
                "intro paragraph about prices\n\nname|price\nlatte|40\nmocha|45\n\nclosing paragraph about prices"

            expect(subject.chunkText(text, 100, 20)).toEqual([
                "intro paragraph about prices",
                "name|price\nlatte|40\nmocha|45",
                "closing paragraph about prices",
            ])
        })

        it("starts with a table without a stray empty passage", async () => {
            const subject = await buildSubject()

            expect(subject.chunkText("name|price\nlatte|40\nmocha|45", 100, 20)).toEqual([
                "name|price\nlatte|40\nmocha|45",
            ])
        })
    })
})
