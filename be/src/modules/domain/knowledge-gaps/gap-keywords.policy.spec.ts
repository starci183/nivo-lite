import { Test } from "@nestjs/testing"
import {
    answers,
    DOC_ANSWERS,
    FACT_ANSWERS,
    keywordsOf,
    sameQuestion,
    splitTopic,
    wordSet,
} from "./gap-keywords.policy"

const SUBJECT = Symbol("gap-keywords.policy")
type Subject = Pick<
    typeof import("./gap-keywords.policy"),
    "answers" | "keywordsOf" | "sameQuestion" | "splitTopic" | "wordSet"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    answers,
                    keywordsOf,
                    sameQuestion,
                    splitTopic,
                    wordSet,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("gap keywords policy", () => {
    it("sets the fact and document coverage thresholds", () => {
        expect(FACT_ANSWERS).toBe(0.6)
        expect(DOC_ANSWERS).toBe(0.75)
    })

    it("keeps unique significant words in appearance order, without accents or greetings", async () => {
        const subject = await buildSubject()

        expect(subject.keywordsOf("Hello, c\u00e0 ph\u00ea price PRICE x 42 please!")).toEqual([
            "ca",
            "phe",
            "price",
            "42",
        ])
        expect(subject.keywordsOf("hi how are you x a")).toEqual([])
    })

    it("requires nonempty questions, sufficient overlap and two shared words unless there is only one", async () => {
        const subject = await buildSubject()

        expect(subject.sameQuestion([], ["price"])).toBe(false)
        expect(subject.sameQuestion(["price"], [])).toBe(false)
        expect(subject.sameQuestion(["tea", "price"], ["price", "tea", "size"])).toBe(true)
        expect(subject.sameQuestion(["tea", "price"], ["price", "size"])).toBe(false)
        expect(subject.sameQuestion(["price"], ["price"])).toBe(true)
        expect(subject.sameQuestion(["tea"], ["coffee"])).toBe(false)
    })

    it("keeps every normalized word longer than one character for text coverage", async () => {
        const subject = await buildSubject()

        expect(subject.wordSet("Hi tea TEA a x 42 c\u00e0 ph\u00ea")).toEqual(new Set(["hi", "tea", "42", "ca", "phe"]))
        expect(subject.wordSet("")).toEqual(new Set())
    })

    it("requires the requested coverage and at least two hits or the sole question word", async () => {
        const subject = await buildSubject()

        const text = new Set(["tea", "price", "size"])
        expect(subject.answers([], text, 0)).toBe(false)
        expect(subject.answers(["tea", "price", "size", "color", "stock"], text, FACT_ANSWERS)).toBe(true)
        expect(subject.answers(["tea", "price", "size", "color"], text, DOC_ANSWERS)).toBe(true)
        expect(subject.answers(["tea", "price", "size", "color"], text, 0.8)).toBe(false)
        expect(subject.answers(["tea", "stock"], text, 0.5)).toBe(false)
        expect(subject.answers(["tea"], text, 1)).toBe(true)
        expect(subject.answers(["stock"], text, 0)).toBe(false)
    })

    it("splits the first two trimmed topic parts and defaults missing parts to null", async () => {
        const subject = await buildSubject()

        expect(subject.splitTopic(undefined)).toEqual({ subject: null, attribute: null })
        expect(subject.splitTopic(null)).toEqual({ subject: null, attribute: null })
        expect(subject.splitTopic(" | ")).toEqual({ subject: null, attribute: null })
        expect(subject.splitTopic(" Tea ")).toEqual({ subject: "Tea", attribute: null })
        expect(subject.splitTopic(" Tea | Price | ignored ")).toEqual({ subject: "Tea", attribute: "Price" })
        expect(subject.splitTopic(`${"s".repeat(121)} | ${"a".repeat(121)}`)).toEqual({
            subject: "s".repeat(120),
            attribute: "a".repeat(120),
        })
    })
})
