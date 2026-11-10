import { TOOL } from "./tool-ids"
import { TOOL_LABELS, toolLabelOf } from "./tool-labels"

describe("tool labels", () => {
    it("names every step tool of the vocabulary", () => {
        const missing = Object.values(TOOL).filter((tool) => toolLabelOf(tool) === null)

        expect(missing).toEqual([])
    })

    it("gives each label a kind, a title and a one-line summary in both languages", () => {
        for (const label of Object.values(TOOL_LABELS)) {
            expect(["acts", "reads"]).toContain(label.kind)
            for (const text of [label.title, label.summary]) {
                expect(text.vi.trim()).not.toBe("")
                expect(text.en.trim()).not.toBe("")
            }
            expect(label.summary.vi).not.toContain("\n")
            expect(label.summary.en).not.toContain("\n")
        }
    })

    it("tells reads from acts", () => {
        expect(toolLabelOf(TOOL.brainSearch)?.kind).toBe("reads")
        expect(toolLabelOf(TOOL.bankTransactions)?.kind).toBe("reads")
        expect(toolLabelOf(TOOL.customerMessageSend)?.kind).toBe("acts")
        expect(toolLabelOf(TOOL.ledgerAppend)?.kind).toBe("acts")
    })

    it("answers null for a tool it does not name, never a property of the object", () => {
        expect(toolLabelOf("nope.tool")).toBeNull()
        expect(toolLabelOf("toString")).toBeNull()
    })
})
