import { CHUNK_OVERLAP, CHUNK_SIZE, chunkText, normalizeText } from "./chunk.policy"

const words = (count: number): string => Array.from({ length: count }, (_, index) => `w${index}`).join(" ")

describe("normalizeText", () => {
    it("composes Vietnamese to NFC so the same letter typed two ways is one thing", () => {
        expect(normalizeText("e\u0301")).toBe("\u00e9")
    })

    it("uses one newline style and drops control, zero-width and soft-hyphen characters", () => {
        expect(normalizeText("a\r\nb\rc\u2028d\u2029e\u0001f\u200bg\u00adh")).toBe("a\nb\nc\nd\nefgh")
    })

    it("turns exotic spaces into spaces and collapses them", () => {
        expect(normalizeText("a\u00a0\u00a0 b\t\tc \n d")).toBe("a b c\nd")
    })

    it("shortens long runs of dots and dashes and keeps at most one blank line", () => {
        expect(normalizeText("wait.......\n\n\n\nend----------")).toBe("wait...\n\nend---")
    })
})

describe("chunkText", () => {
    it("answers nothing for empty text", () => {
        expect(chunkText("")).toEqual([])
        expect(chunkText("  \n\n \t ")).toEqual([])
    })

    it("keeps a short text as one passage", () => {
        expect(chunkText("Opening hours: 8 to 21.")).toEqual(["Opening hours: 8 to 21."])
    })

    it("uses the documented default sizes", () => {
        expect(CHUNK_SIZE).toBe(800)
        expect(CHUNK_OVERLAP).toBe(120)
    })

    it("packs paragraphs up to the size and starts each later passage with the tail of the previous one", () => {
        const first = "alpha beta gamma delta epsilon zeta eta theta iota kappa"
        const second = "lambda mu nu xi omicron pi rho sigma tau upsilon phi chi"
        const third = "one two three four five six seven eight nine ten eleven"

        const passages = chunkText(`${first}\n\n${second}\n\n${third}`, 70, 30)

        expect(passages).toEqual([
            first,
            `${first.slice(-30).slice(first.slice(-30).indexOf(" ") + 1)}\n${second}`,
            `${second.slice(-30).slice(second.slice(-30).indexOf(" ") + 1)}\n${third}`,
        ])
    })

    it("joins small paragraphs into one passage while they fit", () => {
        expect(chunkText("first line\n\nsecond line\n\nthird line", 100)).toEqual([
            "first line\n\nsecond line\n\nthird line",
        ])
    })

    it("adds no overlap when the overlap is zero", () => {
        const passages = chunkText(`${"a".repeat(60)}\n\n${"b".repeat(60)}`, 70, 0)

        expect(passages).toEqual(["a".repeat(60), "b".repeat(60)])
    })

    it("keeps the whole tail when it has no usable space", () => {
        const passages = chunkText(`${"a".repeat(60)}\n\n${"b".repeat(60)}`, 70, 20)

        expect(passages).toEqual(["a".repeat(60), `${"a".repeat(20)}\n${"b".repeat(60)}`])
    })

    it("cuts an over-long block after a sentence end when one is in reach", () => {
        const passages = chunkText(`This sentence is the first one. ${words(20)}`, 60, 0)

        expect(passages[0]).toBe("This sentence is the first one.")
        expect(passages.every((passage) => passage.length <= 60)).toBe(true)
    })

    it("cuts an over-long block at a space when no sentence end is in reach", () => {
        const passages = chunkText(words(40), 50, 0)

        expect(passages).toHaveLength(4)
        expect(passages.every((passage) => passage.length <= 50)).toBe(true)
        expect(passages.join(" ")).toBe(words(40))
    })

    it("cuts a block with no space anywhere at the size without splitting a surrogate pair", () => {
        const text = `${"a".repeat(9)}\u{1f600}${"b".repeat(30)}`

        const passages = chunkText(text, 10, 0)

        expect(passages[0]).toBe("a".repeat(9))
        expect(passages[1]?.startsWith("\u{1f600}")).toBe(true)
    })

    it("cuts a block with no space at the size when the cut is clean", () => {
        expect(chunkText("a".repeat(25), 10, 0)).toEqual(["a".repeat(10), "a".repeat(5)])
    })

    it("keeps a repeated long paragraph once and a repeated short one every time", () => {
        const footer = "Contact us any time at the front desk, thank you."

        expect(chunkText(`${footer}\n\nOK\n\n${footer}\n\nOK`, 100, 0)).toEqual([`${footer}\n\nOK\n\nOK`])
    })

    it("keeps a long block with no letters or digits every time it repeats in the text", () => {
        const marks = "?!".repeat(20)

        expect(chunkText(`${marks}\n\nsome words here\n\n${marks}`, 60, 0)).toEqual([
            `${marks}\n\nsome words here`,
            marks,
        ])
    })

    it("de-duplicates passages made only of punctuation by their raw text", () => {
        const marks = "?!".repeat(20)

        expect(chunkText(`${marks}\n\nsome words here\n\n${marks}`, 45, 0)).toEqual([marks, "some words here"])
    })

    describe("tables", () => {
        it("cuts a table by rows and repeats its header in every passage", () => {
            const header = "name,price,unit"
            const rows = Array.from({ length: 12 }, (_, index) => `item${index},${index}000,cup`)

            const passages = chunkText([header, ...rows].join("\n"), 130, 0)

            expect(passages.length).toBeGreaterThan(1)
            expect(passages.every((passage) => passage.startsWith(`${header}\n`))).toBe(true)
            expect(passages.join("\n")).toContain("item11,11000,cup")
        })

        it.each([
            ["a pipe", "a|b\nc|d\ne|f"],
            ["a semicolon", "a;b\nc;d\ne;f"],
            ["two commas", "a,b,c\nd,e,f\ng,h,i"],
        ])("recognises a table separated by %s", (_name, text) => {
            expect(chunkText(text, 100, 0)).toEqual([text])
        })

        it("does not take a single comma per line for a table", () => {
            expect(chunkText("a, b\nc, d\ne, f", 100, 0)).toEqual(["a, b\nc, d\ne, f"])
        })

        it("does not take fewer than three lines for a table", () => {
            expect(chunkText("a|b\nc|d", 100, 0)).toEqual(["a|b\nc|d"])
        })

        it("does not take a block where few lines carry the delimiter for a table", () => {
            const text = "a|b\nplain\nplain too\nplain again"

            expect(chunkText(text, 100, 0)).toEqual([text])
        })

        it.each([
            ["the larger count first", "a|b|c\nd|e|f\ng|h\ni|j"],
            ["the smaller count first", "a|b\nc|d\ne|f|g\nh|i|j"],
        ])("does not take a block whose lines split evenly between two counts (%s) for a table", (_name, text) => {
            expect(chunkText(text, 100, 0)).toEqual([text])
        })

        it("drops duplicate rows and separator rows", () => {
            const text = "name|price\n---|---\nlatte|40\nlatte|40\nmocha|45"

            expect(chunkText(text, 100, 0)).toEqual(["name|price\nlatte|40\nmocha|45"])
        })

        it("keeps rows that hold no letters or digits every time they repeat", () => {
            const text = "name|price\n,|,\n,|,\nlatte|40"

            expect(chunkText(text, 100, 0)).toEqual(["name|price\n,|,\n,|,\nlatte|40"])
        })

        it("answers a header-only table as its header", () => {
            expect(chunkText("name|price\n---|---\n---|---", 100, 0)).toEqual(["name|price"])
        })

        it("answers nothing for a table made only of separators", () => {
            expect(chunkText("|-|-|\n|-|-|\n|-|-|", 100, 0)).toEqual([])
        })

        it("drops the header when it is longer than half the size", () => {
            const header = `${"h".repeat(60)}|x`
            const text = `${header}\nrow1|a\nrow2|b`

            expect(chunkText(text, 100, 0)).toEqual([`${header}\nrow1|a\nrow2|b`])
        })

        it("splits a row longer than the room of a passage", () => {
            const row = `${words(60)}|end`
            const text = `head|tail\n${row}\nsmall|row\nsmall|two`

            const passages = chunkText(text, 150, 0)

            expect(passages.length).toBeGreaterThan(1)
            expect(passages.join("\n")).toContain("small|two")
        })

        it("keeps a table apart from the prose around it and gives it no overlap", () => {
            const text =
                "intro paragraph about prices\n\nname|price\nlatte|40\nmocha|45\n\nclosing paragraph about prices"

            expect(chunkText(text, 100, 20)).toEqual([
                "intro paragraph about prices",
                "name|price\nlatte|40\nmocha|45",
                "closing paragraph about prices",
            ])
        })

        it("starts with a table without a stray empty passage", () => {
            expect(chunkText("name|price\nlatte|40\nmocha|45", 100, 20)).toEqual(["name|price\nlatte|40\nmocha|45"])
        })
    })
})
