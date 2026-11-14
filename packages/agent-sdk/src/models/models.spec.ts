import {
    AUTO_MODEL,
    AUTO_MODEL_OF_WEIGHT,
    CHEAP_MODEL,
    DEEPSEEK_MODEL,
    DEFAULT_MODEL,
    HAIKU_MODEL,
    MODEL_ENTRIES,
    MODEL_IDS,
    STRONGER_MODEL,
    isModelChoice,
    isModelId,
    isRetiredModel,
    modelEntryOf,
} from "./models"

describe("the model vocabulary", () => {
    it("offers Auto first, then every explicit model once, each labelled in both languages", () => {
        expect(MODEL_ENTRIES.map((entry) => entry.id)).toEqual([AUTO_MODEL, ...MODEL_IDS])
        for (const entry of MODEL_ENTRIES) {
            expect(entry.label.vi.length).toBeGreaterThan(0)
            expect(entry.label.en.length).toBeGreaterThan(0)
            expect(entry.hint.vi.length).toBeGreaterThan(0)
            expect(entry.hint.en.length).toBeGreaterThan(0)
            expect(entry.provider === null).toBe(entry.id === AUTO_MODEL)
        }
    })

    it("defaults to Claude Sonnet 5.5 and maps Auto's weights onto models of the vocabulary", () => {
        expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5")
        expect(AUTO_MODEL_OF_WEIGHT).toEqual({ light: "claude-haiku-5-5", heavy: "claude-sonnet-5-5" })
        expect(isModelId(STRONGER_MODEL)).toBe(true)
        expect(modelEntryOf(DEFAULT_MODEL)?.provider).toBe("anthropic")
    })

    it("offers only Claude (owner: no OpenRouter): Auto, Sonnet 5.5, Haiku 5.5; the cheap tier is Haiku", () => {
        expect(MODEL_ENTRIES.filter((entry) => entry.selectable).map((entry) => entry.id)).toEqual([
            "auto",
            "claude-sonnet-5-5",
            "claude-haiku-5-5",
        ])
        expect(CHEAP_MODEL).toBe(HAIKU_MODEL)
        expect(MODEL_ENTRIES.every((entry) => entry.provider === null || entry.provider === "anthropic")).toBe(true)
    })

    it("keeps DeepSeek flash as a retired id: read with its label, never a choice (the back end refuses it on a saved graph)", () => {
        expect(isRetiredModel(DEEPSEEK_MODEL)).toBe(true)
        expect(isModelChoice(DEEPSEEK_MODEL)).toBe(false)
        expect(isModelId(DEEPSEEK_MODEL)).toBe(false)
        expect(modelEntryOf(DEEPSEEK_MODEL)?.selectable).toBe(false)
        expect(modelEntryOf(DEEPSEEK_MODEL)?.provider).toBe("openrouter")
    })

    it("accepts Auto and the explicit ids, and nothing else", () => {
        expect(isModelChoice("auto")).toBe(true)
        expect(isModelChoice("claude-sonnet-5-5")).toBe(true)
        expect(isModelChoice("gpt-4o")).toBe(false)
        expect(isModelChoice(undefined)).toBe(false)
        expect(isModelId("auto")).toBe(false)
    })
})
