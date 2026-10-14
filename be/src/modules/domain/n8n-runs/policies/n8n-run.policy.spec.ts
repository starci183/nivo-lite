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

const RUN_ID = "11111111-2222-4333-8444-555555555555"

describe("parseBearer", () => {
    it("reads the token and the run id out of the header", () => {
        expect(parseBearer(`Bearer ${RUN_ID}.secret`)).toEqual({ token: `${RUN_ID}.secret`, runId: RUN_ID })
    })

    it.each([undefined, null, "", "Basic abc", "Bearer", "Bearer not-a-uuid.secret"])("refuses %p", (header) => {
        expect(parseBearer(header)).toBeNull()
    })
})

describe("tokens", () => {
    it("matches a token to its stored hash and nothing else", () => {
        const stored = hashToken("abc")

        expect(tokenMatches(stored, "abc")).toBe(true)
        expect(tokenMatches(stored, "abd")).toBe(false)
        expect(tokenMatches("short", "abc")).toBe(false)
    })

    it("keeps a token for half an hour", () => {
        expect(RUN_TOKEN_TTL_MS).toBe(1_800_000)
    })
})

describe("workflow and run state", () => {
    it("accepts a kebab-case key and refuses the rest", () => {
        expect(isWorkflowKey("email-daily-report")).toBe(true)
        expect(isWorkflowKey("Email")).toBe(false)
        expect(isWorkflowKey("a")).toBe(false)
    })

    it("keeps a run open until it is finished", () => {
        expect(runIsOpen("running")).toBe(true)
        expect(runIsOpen("queued")).toBe(true)
        expect(runIsOpen("done")).toBe(false)
        expect(runIsOpen("failed")).toBe(false)
        expect(runIsOpen("skipped")).toBe(false)
    })

    it("takes failed and skipped as named and everything else as done", () => {
        expect(finalStatusOf("failed")).toBe("failed")
        expect(finalStatusOf("skipped")).toBe("skipped")
        expect(finalStatusOf("whatever")).toBe("done")
        expect(finalStatusOf(undefined)).toBe("done")
    })
})

describe("summaryOf", () => {
    const word = (key: string) => `w:${key}`

    it("keeps the text n8n sent, cut to 600 characters", () => {
        expect(summaryOf("x".repeat(700), undefined, word)).toHaveLength(600)
    })

    it("puts the counters in words when no text was sent", () => {
        expect(summaryOf(undefined, { counts: { sent: 2, skipped: 1, ignored: "no" } }, word)).toBe(
            "w:sent: 2 · w:skipped: 1",
        )
    })

    it.each([
        [{}, "no counters"],
        [{ counts: {} }, "empty counters"],
        [{ counts: { a: "text" } }, "no numeric counter"],
        [null, "no result"],
        [{ counts: 3 }, "counters that are not a record"],
    ])("answers nothing for %p (%s)", (result, _reason) => {
        expect(summaryOf(undefined, result, word)).toBeNull()
    })
})

describe("boundedResult", () => {
    it("keeps a small record and refuses anything else", () => {
        expect(boundedResult({ a: 1 })).toEqual({ a: 1 })
        expect(boundedResult("text")).toBeNull()
    })

    it("marks a record that is too big", () => {
        expect(boundedResult({ big: "x".repeat(9000) })).toEqual({ truncated: true })
    })
})

describe("scalars and refsOf", () => {
    it("keeps text and numbers under well-formed names, text cut", () => {
        expect(scalars({ ok: "a", n: 1, "bad name": "x", obj: {}, long: "y".repeat(5000) }).long).toHaveLength(4000)
        expect(scalars({ ok: "a", n: 1, "bad name": "x", obj: {} })).toEqual({ ok: "a", n: 1 })
        expect(scalars("nope")).toEqual({})
    })

    it("keeps text, numbers and nulls of references, text cut", () => {
        expect(refsOf({ lead: "l-1", amount: 3, none: null, "bad name": "x", obj: {} })).toEqual({
            lead: "l-1",
            amount: 3,
            none: null,
        })
        expect(refsOf({ lead: "x".repeat(300) }).lead).toHaveLength(200)
        expect(refsOf(null)).toEqual({})
    })
})

describe("attachmentsOf", () => {
    it("keeps at most two well-formed attachments with their encoding", () => {
        const items = [
            { filename: "a.csv", content: "x", contentType: "text/csv", encoding: "base64" },
            { filename: "b.txt", content: "y" },
            { filename: "c.txt", content: "z" },
        ]

        expect(attachmentsOf(items)).toEqual([
            { filename: "a.csv", content: "x", contentType: "text/csv", encoding: "base64" },
            { filename: "b.txt", content: "y", contentType: undefined, encoding: "utf8" },
        ])
    })

    it("drops anything that is not an attachment", () => {
        expect(attachmentsOf([null, { filename: 1, content: "x" }, { filename: "a", content: 2 }])).toEqual([])
        expect(attachmentsOf("no")).toEqual([])
    })

    it("drops attachments whose filename is text but whose content is not", () => {
        expect(attachmentsOf([{ filename: "a.txt", content: 2 }])).toEqual([])
    })
})

describe("renderTemplate", () => {
    it.each(["", "{missing}", "{{ missing }}"])("renders an empty substituted template for %p", (template) => {
        expect(renderTemplate(template, {})).toBe("")
    })

    it("fills single and double braces and empties unknown names", () => {
        expect(renderTemplate("Hi {name}, {{ day }} {missing}!", { name: "Lan", day: 3 })).toBe("Hi Lan, 3 !")
    })

    it("keeps line breaks and tabs and drops other control characters", () => {
        expect(renderTemplate("a\tb\nc\r\u0001\u000b\u001fd", {})).toBe("a\tb\nc\rd")
    })

    it("drops form feed and preserves characters beyond the control range, including emoji", () => {
        expect(renderTemplate("\u000c\u000d\u000e\u0020\u007f\u{1f642}", {})).toBe("\r \u007f\u{1f642}")
    })
})

describe("oneLine", () => {
    it("joins lines and cuts the text", () => {
        expect(oneLine("  a\r\nb\n\nc  ")).toBe("a b c")
        expect(oneLine("x".repeat(300))).toHaveLength(200)
        expect(oneLine("abcdef", 3)).toBe("abc")
    })
})
