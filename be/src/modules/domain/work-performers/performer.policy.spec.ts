import { dotted, firstText, historyLine, leadHref, numberOf, stageOf, textOf } from "./performer.policy"

describe("textOf", () => {
    it("reads a text field as itself", () => {
        expect(textOf("tea")).toBe("tea")
    })

    it("reads a number field as its digits", () => {
        expect(textOf(12000)).toBe("12000")
    })

    it("reads a missing field as empty", () => {
        expect(textOf(undefined)).toBe("")
    })

    it("reads a null field as empty", () => {
        expect(textOf(null)).toBe("")
    })
})

describe("numberOf", () => {
    it("reads a number field", () => {
        expect(numberOf(12000)).toBe(12000)
    })

    it("reads a text field as no number", () => {
        expect(numberOf("12000")).toBeNull()
    })

    it("reads a null field as no number", () => {
        expect(numberOf(null)).toBeNull()
    })

    it("reads a missing field as no number", () => {
        expect(numberOf(undefined)).toBeNull()
    })
})

describe("leadHref", () => {
    it("opens the lead", () => {
        expect(leadHref("lead-1")).toBe("/leads/lead-1")
    })

    it("opens the chat when the customer is not a lead", () => {
        expect(leadHref(null)).toBe("/chat")
    })

    it("opens the chat when no lead was named", () => {
        expect(leadHref(undefined)).toBe("/chat")
    })
})

describe("stageOf", () => {
    it.each(["new", "qualified", "proposal", "won", "lost"])("keeps the stage %s", (stage) => {
        expect(stageOf(stage)).toBe(stage)
    })

    it("rejects a text that is not a stage", () => {
        expect(stageOf("closed")).toBeNull()
    })
})

describe("dotted", () => {
    it("joins the parts that have text", () => {
        expect(dotted(["Hue", null, "", undefined, "tea"])).toBe("Hue · tea")
    })

    it("is empty when every part is empty", () => {
        expect(dotted([null, undefined, ""])).toBe("")
    })
})

describe("historyLine", () => {
    it("is the summary alone when there is no evidence", () => {
        expect(historyLine("Asked for a quote", null)).toBe("Asked for a quote")
    })

    it("is the summary alone when the evidence is empty", () => {
        expect(historyLine("Asked for a quote", "")).toBe("Asked for a quote")
    })

    it("appends the first 400 characters of the evidence", () => {
        const evidence = `${"a".repeat(400)}tail`

        expect(historyLine("Asked for a quote", evidence)).toBe(`Asked for a quote: ${"a".repeat(400)}`)
    })
})

describe("firstText", () => {
    it("keeps the first text that is not empty", () => {
        expect(firstText(["", "quote", "invoice"])).toBe("quote")
    })

    it("is empty when every text is empty", () => {
        expect(firstText(["", ""])).toBe("")
    })

    it("is empty when there is no text", () => {
        expect(firstText([])).toBe("")
    })
})
