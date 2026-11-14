import { ENGINE_TOOL_LABELS } from "./tool-labels"
import { TOOL } from "./tool"

const TOOL_IDS: ReadonlySet<string> = new Set(Object.values(TOOL))

describe("the words of the engine's native tools", () => {
    it("label nineteen tools, each a real tool id of the vocabulary", () => {
        const ids = Object.keys(ENGINE_TOOL_LABELS)
        expect(ids).toHaveLength(19)
        expect(ids.filter((id) => !TOOL_IDS.has(id))).toEqual([])
    })

    it("give each a kind, a title and a one-line summary in both languages", () => {
        for (const label of Object.values(ENGINE_TOOL_LABELS)) {
            expect(["acts", "reads"]).toContain(label.kind)
            for (const text of [label.title, label.summary]) {
                expect(text.vi.trim()).not.toBe("")
                expect(text.en.trim()).not.toBe("")
            }
            expect(label.summary.vi).not.toContain("\n")
            expect(label.summary.en).not.toContain("\n")
        }
    })

    it("tell a read from an act", () => {
        expect(ENGINE_TOOL_LABELS[TOOL.mailMessageList]?.kind).toBe("reads")
        expect(ENGINE_TOOL_LABELS[TOOL.recordGet]?.kind).toBe("reads")
        expect(ENGINE_TOOL_LABELS[TOOL.recordCreate]?.kind).toBe("acts")
        expect(ENGINE_TOOL_LABELS[TOOL.contactMerge]?.kind).toBe("acts")
    })
})
