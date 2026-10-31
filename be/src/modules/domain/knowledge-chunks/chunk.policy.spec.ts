import { Test } from "@nestjs/testing"
import { CHUNK_OVERLAP, CHUNK_SIZE, chunkPassages, chunkText, normalizeText } from "./chunk.policy"
import fixtures from "./chunk.policy.fixtures.json"

type Subject = {
    normalizeText: typeof normalizeText
    chunkText: typeof chunkText
    chunkPassages: typeof chunkPassages
}

const words = (count: number): string => Array.from({ length: count }, (_, index) => `w${index}`).join(" ")

const SUBJECT = Symbol("chunk.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { normalizeText, chunkText, chunkPassages } }],
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

describe("chunkPassages", () => {
    it("answers nothing for an empty file", async () => {
        const subject = await buildSubject()

        expect(subject.chunkPassages("")).toEqual([])
        expect(subject.chunkPassages("  \n\n \t ")).toEqual([])
    })

    it("uses the size of a passage as its default cap and never goes over it", async () => {
        const subject = await buildSubject()
        const passages = subject.chunkPassages(`${"x".repeat(CHUNK_SIZE * 3)}\n\n${words(900)}`)

        expect(passages.length).toBeGreaterThan(3)
        expect(Math.max(...passages.map((passage) => passage.length))).toBeLessThanOrEqual(CHUNK_SIZE)
    })

    it("cuts at a legal heading, with or without accents, and never packs across one", async () => {
        const subject = await buildSubject()
        const text = "\u0110i\u1ec1u 1. Scope\nFirst rule.\nDieu 2: Terms\nSecond rule.\nCh\u01b0\u01a1ng III\nThird rule."

        expect(subject.chunkPassages(text)).toEqual([
            "\u0110i\u1ec1u 1. Scope\nFirst rule.",
            "Dieu 2: Terms\nSecond rule.",
            "Ch\u01b0\u01a1ng III\nThird rule.",
        ])
    })

    it("cuts at a Markdown heading, a Roman numeral and a short line in capitals", async () => {
        const subject = await buildSubject()
        const text = "## One\nBody one.\nII. Two\nBody two.\nTHREE\nBody three."

        expect(subject.chunkPassages(text)).toEqual(["## One\nBody one.", "II. Two\nBody two.", "THREE\nBody three."])
    })

    it("keeps headings in a row with the body that follows them", async () => {
        const subject = await buildSubject()

        expect(subject.chunkPassages("Ch\u01b0\u01a1ng I\nGENERAL\nDieu 1. Scope\nBody.")).toEqual([
            "Ch\u01b0\u01a1ng I\nGENERAL\nDieu 1. Scope\nBody.",
        ])
    })

    it("does not take a list in capitals or a long line in capitals for a heading", async () => {
        const subject = await buildSubject()
        const long = "L".repeat(130)

        expect(subject.chunkPassages(`Intro.\nA, B, C\nMore.\n${long}\nEnd.`)).toEqual([
            `Intro.\nA, B, C\nMore.\n${long}\nEnd.`,
        ])
    })

})

describe("chunkPassages tables, repeats and what a passage carries", () => {
    it("keeps a table whole with its header, even when a row reads like a heading", async () => {
        const subject = await buildSubject()
        const table = "Item | Fee\nDieu 1 | 100\nDieu 2 | 200\nDieu 3 | 300"

        expect(subject.chunkPassages(`Dieu 9. Fees\nBelow.\n\n${table}`)).toEqual(["Dieu 9. Fees\nBelow.", table])
    })

    it("treats a block of clauses ending in semicolons as prose when a heading sits inside it", async () => {
        const subject = await buildSubject()
        const text = "Dieu 1. A\na) one;\nb) two;\nc) three;\nDieu 2. B\na) four;\nb) five;\nc) six;"

        const passages = subject.chunkPassages(text)

        expect(passages).toHaveLength(2)
        expect(passages[1]).toContain("Dieu 2. B")
    })

    it("keeps one of two identical sections and a repeated long paragraph once", async () => {
        const subject = await buildSubject()
        const footer = "This footer repeats at the end of every section."

        expect(subject.chunkPassages(`## A\nSame.\n## A\nSame.`)).toEqual(["## A\nSame."])
        expect(subject.chunkPassages(`## A\n\n${footer}\n\n## B\n\n${footer}`)).toEqual([
            `## A\n\n${footer}`,
            "## B",
        ])
    })

    it("carries no tail of the passage before it, so a hash depends on its own text", async () => {
        const subject = await buildSubject()
        const first = `${"a ".repeat(390)}end.`
        const second = `${"b ".repeat(390)}end.`

        expect(subject.chunkPassages(`${first}\n\n${second}`)).toEqual([first, second])
    })

    it("stores text that normalising leaves as it is, as the hash backfill relies on", async () => {
        const subject = await buildSubject()

        for (const text of Object.values(fixtures.documents)) {
            for (const passage of subject.chunkPassages(text)) expect(subject.normalizeText(passage)).toBe(passage)
        }
    })
})

/** How the passages of a document survive a one-line edit at every fifth line. */
const survivalOf = (cut: (text: string) => ReadonlyArray<string>, text: string, edit: LineEdit) => {
    const lines = text.split("\n")
    const had = new Set(cut(text))
    const tally = { kept: 0, total: 0, worst: 1 }
    lines.forEach((line, index) => {
        if (index % 5 !== 0 || line.trim() === "") return
        const now = cut(edit(lines, index).join("\n"))
        const kept = now.filter((passage) => had.has(passage)).length
        tally.kept += kept
        tally.total += now.length
        tally.worst = Math.min(tally.worst, kept / now.length)
    })
    return { mean: tally.kept / tally.total, worst: tally.worst }
}

/** One edit of a document at a line. */
type LineEdit = (lines: ReadonlyArray<string>, index: number) => ReadonlyArray<string>

const EDITS: ReadonlyArray<readonly [string, LineEdit]> = [
    ["edit a line", (lines, index) => lines.map((line, at) => (at === index ? `${line} (changed)` : line))],
    ["add a line", (lines, index) => [...lines.slice(0, index + 1), "One added line. ".repeat(4).trim(), ...lines.slice(index + 1)]],
    ["drop a line", (lines, index) => lines.filter((_, at) => at !== index)],
]

describe("chunkPassages one-line edits on the Vietnamese samples", () => {
    const documents = Object.entries(fixtures.documents)

    it.each(EDITS)("keeps at least 91% of passages on average and 80% at worst: %s", async (_name, edit) => {
        const subject = await buildSubject()

        for (const [, text] of documents) {
            const { mean, worst } = survivalOf((body) => subject.chunkPassages(body), text, edit)
            expect(mean).toBeGreaterThanOrEqual(0.91)
            expect(worst).toBeGreaterThanOrEqual(0.8)
        }
    })

    it("beats the fixed cut on a text broken at a fixed width, as a PDF gives it", async () => {
        const subject = await buildSubject()
        const add = EDITS[1]?.[1] ?? ((lines) => lines)

        const fixed = survivalOf((body) => subject.chunkText(body), fixtures.documents.wrappedDecree, add)
        const structural = survivalOf((body) => subject.chunkPassages(body), fixtures.documents.wrappedDecree, add)

        expect(structural.mean).toBeGreaterThan(fixed.mean)
        expect(structural.worst).toBeGreaterThan(fixed.worst)
    })
})
