import { IntentContractsError } from "./errors/intent-contracts.error"
import { GraphVocabularyPolicy } from "./graph-vocabulary.policy"

describe("GraphVocabularyPolicy", () => {
    it("knows the built-in kinds, steps and providers", () => {
        const vocabulary = new GraphVocabularyPolicy()

        expect(vocabulary.hasKind("output")).toBe(true)
        expect(vocabulary.hasStep("reply")).toBe(true)
        expect(vocabulary.stepsOf("trigger")).toContain("schedule")
        expect(vocabulary.hasProvider("zalo")).toBe(true)
    })

    it("refuses a word nobody registered", () => {
        const vocabulary = new GraphVocabularyPolicy()

        expect(vocabulary.hasProvider("fax")).toBe(false)
        expect(vocabulary.hasStep("print")).toBe(false)
        expect(vocabulary.hasKind("dream")).toBe(false)
    })

    it("accepts the provider and the step a plug-in registers under an existing kind", () => {
        const vocabulary = new GraphVocabularyPolicy()

        vocabulary.add({ providers: ["fax"], steps: { output: ["print"] } })

        expect(vocabulary.hasProvider("fax")).toBe(true)
        expect(vocabulary.stepsOf("output")).toContain("print")
        expect(vocabulary.providerNames()).toContain("fax")
    })

    it("refuses a step registered under a kind that does not exist", () => {
        const vocabulary = new GraphVocabularyPolicy()

        expect(() => vocabulary.add({ steps: { dream: ["nap"] } })).toThrow(IntentContractsError)
    })
})
