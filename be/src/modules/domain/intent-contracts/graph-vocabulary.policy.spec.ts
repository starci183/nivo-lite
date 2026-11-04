import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { graphVocabulary } from "./graph-vocabulary.policy"

const SUBJECT = Symbol("graph-vocabulary.policy")

interface Subject {
    readonly graphVocabulary: typeof graphVocabulary
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<Subject>({ graphVocabulary }) }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("graphVocabulary", () => {
    it("is the one vocabulary of the process, with the built-in words and the words a plug-in registers", async () => {
        const subject = await build()

        expect(subject.graphVocabulary.hasKind("output")).toBe(true)
        expect(subject.graphVocabulary.hasProvider("zalo")).toBe(true)

        subject.graphVocabulary.add({ providers: ["viettel-post"] })

        expect(subject.graphVocabulary.hasProvider("viettel-post")).toBe(true)
        expect(subject.graphVocabulary).toBe(graphVocabulary)
    })
})
