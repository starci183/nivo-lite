import { graphVocabulary } from "./graph-vocabulary.policy"

describe("graphVocabulary", () => {
    it("is the one vocabulary of the process, with the built-in words and the words a plug-in registers", () => {
        expect(graphVocabulary.hasKind("output")).toBe(true)
        expect(graphVocabulary.hasProvider("zalo")).toBe(true)

        graphVocabulary.add({ providers: ["viettel-post"] })

        expect(graphVocabulary.hasProvider("viettel-post")).toBe(true)
        expect(graphVocabulary).toBe(graphVocabulary)
    })
})
