import { Test } from "@nestjs/testing"
import {
    RUN_TOKEN_TTL_MS,
    attachmentsOf,
    boundedResult,
    finalStatusOf,
    hashToken,
    isWorkflowKey,
    oneLine,
    parseBearer,
    refsOf,
    renderTemplate,
    runIsOpen,
    scalars,
    summaryOf,
    tokenMatches,
} from "./n8n-run.policy"

type Subject = {
    parseBearer: typeof parseBearer
    hashToken: typeof hashToken
    tokenMatches: typeof tokenMatches
    isWorkflowKey: typeof isWorkflowKey
    runIsOpen: typeof runIsOpen
    finalStatusOf: typeof finalStatusOf
    summaryOf: typeof summaryOf
    boundedResult: typeof boundedResult
    scalars: typeof scalars
    refsOf: typeof refsOf
    attachmentsOf: typeof attachmentsOf
    renderTemplate: typeof renderTemplate
    oneLine: typeof oneLine
}

const RUN_ID = "11111111-2222-4333-8444-555555555555"

const SUBJECT = Symbol("n8n-run.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    parseBearer,
                    hashToken,
                    tokenMatches,
                    isWorkflowKey,
                    runIsOpen,
                    finalStatusOf,
                    summaryOf,
                    boundedResult,
                    scalars,
                    refsOf,
                    attachmentsOf,
                    renderTemplate,
                    oneLine,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("parseBearer", () => {
    it("reads the token and the run id out of the header", async () => {
        const subject = await buildSubject()

        expect(subject.parseBearer(`Bearer ${RUN_ID}.secret`)).toEqual({ token: `${RUN_ID}.secret`, runId: RUN_ID })
    })

    it.each([undefined, null, "", "Basic abc", "Bearer", "Bearer not-a-uuid.secret"])("refuses %p", async (header) => {
        const subject = await buildSubject()

        expect(subject.parseBearer(header)).toBeNull()
    })
})

describe("tokens", () => {
    it("matches a token to its stored hash and nothing else", async () => {
        const subject = await buildSubject()

        const stored = subject.hashToken("abc")

        expect(subject.tokenMatches(stored, "abc")).toBe(true)
        expect(subject.tokenMatches(stored, "abd")).toBe(false)
        expect(subject.tokenMatches("short", "abc")).toBe(false)
    })

    it("keeps a token for half an hour", () => {
        expect(RUN_TOKEN_TTL_MS).toBe(1_800_000)
    })
})

describe("workflow and run state", () => {
    it("accepts a kebab-case key and refuses the rest", async () => {
        const subject = await buildSubject()

        expect(subject.isWorkflowKey("email-daily-report")).toBe(true)
        expect(subject.isWorkflowKey("Email")).toBe(false)
        expect(subject.isWorkflowKey("a")).toBe(false)
    })

    it("keeps a run open until it is finished", async () => {
        const subject = await buildSubject()

        expect(subject.runIsOpen("running")).toBe(true)
        expect(subject.runIsOpen("queued")).toBe(true)
        expect(subject.runIsOpen("done")).toBe(false)
        expect(subject.runIsOpen("failed")).toBe(false)
        expect(subject.runIsOpen("skipped")).toBe(false)
    })

    it("takes failed and skipped as named and everything else as done", async () => {
        const subject = await buildSubject()

        expect(subject.finalStatusOf("failed")).toBe("failed")
        expect(subject.finalStatusOf("skipped")).toBe("skipped")
        expect(subject.finalStatusOf("whatever")).toBe("done")
        expect(subject.finalStatusOf(undefined)).toBe("done")
    })
})

describe("summaryOf", () => {
    const word = (key: string) => `w:${key}`

    it("keeps the text n8n sent, cut to 600 characters", async () => {
        const subject = await buildSubject()

        expect(subject.summaryOf("x".repeat(700), undefined, word)).toHaveLength(600)
    })

    it("puts the counters in words when no text was sent", async () => {
        const subject = await buildSubject()

        expect(subject.summaryOf(undefined, { counts: { sent: 2, skipped: 1, ignored: "no" } }, word)).toBe(
            "w:sent: 2 · w:skipped: 1",
        )
    })

    it.each([
        [{}, "no counters"],
        [{ counts: {} }, "empty counters"],
        [{ counts: { a: "text" } }, "no numeric counter"],
        [null, "no result"],
        [{ counts: 3 }, "counters that are not a record"],
    ])("answers nothing for %p (%s)", async (result, _reason) => {
        const subject = await buildSubject()

        expect(subject.summaryOf(undefined, result, word)).toBeNull()
    })
})

describe("boundedResult", () => {
    it("keeps a small record and refuses anything else", async () => {
        const subject = await buildSubject()

        expect(subject.boundedResult({ a: 1 })).toEqual({ a: 1 })
        expect(subject.boundedResult("text")).toBeNull()
    })

    it("marks a record that is too big", async () => {
        const subject = await buildSubject()

        expect(subject.boundedResult({ big: "x".repeat(9000) })).toEqual({ truncated: true })
    })
})

describe("scalars and refsOf", () => {
    it("keeps text and numbers under well-formed names, text cut", async () => {
        const subject = await buildSubject()

        expect(subject.scalars({ ok: "a", n: 1, "bad name": "x", obj: {}, long: "y".repeat(5000) }).long).toHaveLength(
            4000,
        )
        expect(subject.scalars({ ok: "a", n: 1, "bad name": "x", obj: {} })).toEqual({ ok: "a", n: 1 })
        expect(subject.scalars("nope")).toEqual({})
    })

    it("keeps text, numbers and nulls of references, text cut", async () => {
        const subject = await buildSubject()

        expect(subject.refsOf({ lead: "l-1", amount: 3, none: null, "bad name": "x", obj: {} })).toEqual({
            lead: "l-1",
            amount: 3,
            none: null,
        })
        expect(subject.refsOf({ lead: "x".repeat(300) }).lead).toHaveLength(200)
        expect(subject.refsOf(null)).toEqual({})
    })
})

describe("attachmentsOf", () => {
    it("keeps at most two well-formed attachments with their encoding", async () => {
        const subject = await buildSubject()

        const items = [
            { filename: "a.csv", content: "x", contentType: "text/csv", encoding: "base64" },
            { filename: "b.txt", content: "y" },
            { filename: "c.txt", content: "z" },
        ]

        expect(subject.attachmentsOf(items)).toEqual([
            { filename: "a.csv", content: "x", contentType: "text/csv", encoding: "base64" },
            { filename: "b.txt", content: "y", contentType: undefined, encoding: "utf8" },
        ])
    })

    it("drops anything that is not an attachment", async () => {
        const subject = await buildSubject()

        expect(subject.attachmentsOf([null, { filename: 1, content: "x" }, { filename: "a", content: 2 }])).toEqual([])
        expect(subject.attachmentsOf("no")).toEqual([])
    })

    it("drops attachments whose filename is text but whose content is not", async () => {
        const subject = await buildSubject()

        expect(subject.attachmentsOf([{ filename: "a.txt", content: 2 }])).toEqual([])
    })
})

describe("renderTemplate", () => {
    it.each(["", "{missing}", "{{ missing }}"])("renders an empty substituted template for %p", async (template) => {
        const subject = await buildSubject()

        expect(subject.renderTemplate(template, {})).toBe("")
    })

    it("fills single and double braces and empties unknown names", async () => {
        const subject = await buildSubject()

        expect(subject.renderTemplate("Hi {name}, {{ day }} {missing}!", { name: "Lan", day: 3 })).toBe("Hi Lan, 3 !")
    })

    it("keeps line breaks and tabs and drops other control characters", async () => {
        const subject = await buildSubject()

        expect(subject.renderTemplate("a\tb\nc\r\u0001\u000b\u001fd", {})).toBe("a\tb\nc\rd")
    })

    it("drops form feed and preserves characters beyond the control range, including emoji", async () => {
        const subject = await buildSubject()

        expect(subject.renderTemplate("\u000c\u000d\u000e\u0020\u007f\u{1f642}", {})).toBe("\r \u007f\u{1f642}")
    })

    it("preserves astral characters and lone surrogates while dropping adjacent controls", async () => {
        const subject = await buildSubject()

        expect(subject.renderTemplate("\u{1f642}\u0000\ud800x\udfff\u001f", {})).toBe("\u{1f642}\ud800x\udfff")
    })
})

describe("oneLine", () => {
    it("joins lines and cuts the text", async () => {
        const subject = await buildSubject()

        expect(subject.oneLine("  a\r\nb\n\nc  ")).toBe("a b c")
        expect(subject.oneLine("x".repeat(300))).toHaveLength(200)
        expect(subject.oneLine("abcdef", 3)).toBe("abc")
    })
})
