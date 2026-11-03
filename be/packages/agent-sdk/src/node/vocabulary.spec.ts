import { NodeVocabulary, VocabularyError } from "./vocabulary"

describe("NodeVocabulary", () => {
    it("knows the built-in kinds, steps and providers", () => {
        const vocabulary = new NodeVocabulary()

        expect(vocabulary.hasKind("output")).toBe(true)
        expect(vocabulary.hasStep("reply")).toBe(true)
        expect(vocabulary.stepsOf("trigger")).toContain("schedule")
        expect(vocabulary.hasProvider("zalo")).toBe(true)
        expect(vocabulary.providerNames()).toContain("brain")
    })

    it("refuses a word nobody registered", () => {
        const vocabulary = new NodeVocabulary()

        expect(vocabulary.hasProvider("fax")).toBe(false)
        expect(vocabulary.hasStep("print")).toBe(false)
        expect(vocabulary.hasKind("dream")).toBe(false)
        expect(vocabulary.stepsOf("dream")).toEqual([])
    })

    it("accepts the provider and the step a plug-in registers under an existing kind", () => {
        const vocabulary = new NodeVocabulary()

        vocabulary.add({ providers: ["fax"], steps: { output: ["print"] } })

        expect(vocabulary.hasProvider("fax")).toBe(true)
        expect(vocabulary.stepsOf("output")).toContain("print")
    })

    it("accepts an empty manifest", () => {
        const vocabulary = new NodeVocabulary()

        vocabulary.add({})

        expect(vocabulary.providerNames()).toHaveLength(7)
    })

    it("refuses a step registered under a kind that does not exist", () => {
        const vocabulary = new NodeVocabulary()

        expect(() => vocabulary.add({ steps: { dream: ["nap"] } })).toThrow(VocabularyError)
        expect(() => vocabulary.add({ steps: { dream: ["nap"] } })).toThrow("KIND_UNKNOWN: dream")
    })

    it("registers a kind with its steps, facts and checks, and reads them back", () => {
        const vocabulary = new NodeVocabulary()

        vocabulary.add({
            kinds: [
                {
                    kind: "ship",
                    steps: ["pick", "pack"],
                    facts: { weight: { type: "number", unit: "kg", allowed: [] } },
                    checks: ["fits_van"],
                },
            ],
        })

        expect(vocabulary.hasKind("ship")).toBe(true)
        expect(vocabulary.hasStep("pack")).toBe(true)
        expect(vocabulary.stepsOf("ship")).toEqual(["pick", "pack"])
        expect(vocabulary.factsOf("ship")).toEqual({ weight: { type: "number", unit: "kg", allowed: [] } })
        expect(vocabulary.checksOf("ship")).toEqual(["fits_van"])
    })

    it("says no facts and no checks for a built-in kind, and refuses a kind registered twice or taking a built-in name", () => {
        const vocabulary = new NodeVocabulary()
        const registration = { kind: "ship", steps: ["pick"], facts: {}, checks: [] }

        vocabulary.registerKind(registration)

        expect(vocabulary.factsOf("trigger")).toEqual({})
        expect(vocabulary.checksOf("trigger")).toEqual([])
        expect(() => vocabulary.registerKind(registration)).toThrow("KIND_DUPLICATE: ship")
        expect(() => vocabulary.registerKind({ ...registration, kind: "output" })).toThrow(VocabularyError)
    })
})
