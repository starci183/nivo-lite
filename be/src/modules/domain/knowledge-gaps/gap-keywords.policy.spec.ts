import {
    answers,
    DOC_ANSWERS,
    FACT_ANSWERS,
    keywordsOf,
    sameQuestion,
    splitTopic,
    wordSet,
} from "./gap-keywords.policy"

describe("gap keywords policy", () => {
    it("sets the fact and document coverage thresholds", () => {
        expect(FACT_ANSWERS).toBe(0.6)
        expect(DOC_ANSWERS).toBe(0.75)
    })

    it("keeps unique significant words in appearance order, without accents or greetings", () => {
        expect(keywordsOf("Hello, c\u00e0 ph\u00ea price PRICE x 42 please!")).toEqual(["ca", "phe", "price", "42"])
        expect(keywordsOf("hi how are you x a")).toEqual([])
    })

    it("requires nonempty questions, sufficient overlap and two shared words unless there is only one", () => {
        expect(sameQuestion([], ["price"])).toBe(false)
        expect(sameQuestion(["price"], [])).toBe(false)
        expect(sameQuestion(["tea", "price"], ["price", "tea", "size"])).toBe(true)
        expect(sameQuestion(["tea", "price"], ["price", "size"])).toBe(false)
        expect(sameQuestion(["price"], ["price"])).toBe(true)
        expect(sameQuestion(["tea"], ["coffee"])).toBe(false)
    })

    it("keeps every normalized word longer than one character for text coverage", () => {
        expect(wordSet("Hi tea TEA a x 42 c\u00e0 ph\u00ea")).toEqual(new Set(["hi", "tea", "42", "ca", "phe"]))
        expect(wordSet("")).toEqual(new Set())
    })

    it("requires the requested coverage and at least two hits or the sole question word", () => {
        const text = new Set(["tea", "price", "size"])
        expect(answers([], text, 0)).toBe(false)
        expect(answers(["tea", "price", "size", "color", "stock"], text, FACT_ANSWERS)).toBe(true)
        expect(answers(["tea", "price", "size", "color"], text, DOC_ANSWERS)).toBe(true)
        expect(answers(["tea", "price", "size", "color"], text, 0.8)).toBe(false)
        expect(answers(["tea", "stock"], text, 0.5)).toBe(false)
        expect(answers(["tea"], text, 1)).toBe(true)
        expect(answers(["stock"], text, 0)).toBe(false)
    })

    it("splits the first two trimmed topic parts and defaults missing parts to null", () => {
        expect(splitTopic(undefined)).toEqual({ subject: null, attribute: null })
        expect(splitTopic(null)).toEqual({ subject: null, attribute: null })
        expect(splitTopic(" | ")).toEqual({ subject: null, attribute: null })
        expect(splitTopic(" Tea ")).toEqual({ subject: "Tea", attribute: null })
        expect(splitTopic(" Tea | Price | ignored ")).toEqual({ subject: "Tea", attribute: "Price" })
        expect(splitTopic(`${"s".repeat(121)} | ${"a".repeat(121)}`)).toEqual({
            subject: "s".repeat(120),
            attribute: "a".repeat(120),
        })
    })
})
