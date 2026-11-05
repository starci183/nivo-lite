import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { keepRaw, relabeller } from "./value-labels"

const words = (text: SpecText): string => ("key" in text ? text.key : text.en)
const LABELS = { stage: { won: { vi: "Thang", en: "Won" }, lost: { key: "stage_lost" } } }

describe("relabeller", () => {
    it("draws a value as the words its path gives it", () => {
        const relabel = relabeller(LABELS, words)
        expect(relabel("stage", "won")).toBe("Won")
        expect(relabel("stage", "lost")).toBe("stage_lost")
    })

    it("draws a value with no words as it is", () => {
        const relabel = relabeller(LABELS, words)
        expect(relabel("stage", "new")).toBe("new")
        expect(relabel("kind", "won")).toBe("won")
    })

    it("draws every value as it is when the block has no labels", () => {
        expect(relabeller(undefined, words)("stage", "won")).toBe("won")
    })

    it("never reads a key of the prototype as a label", () => {
        const relabel = relabeller(LABELS, words)
        expect(relabel("constructor", "won")).toBe("won")
        expect(relabel("stage", "toString")).toBe("toString")
    })
})

describe("keepRaw", () => {
    it("returns the raw text", () => {
        expect(keepRaw("stage", "won")).toBe("won")
    })
})
