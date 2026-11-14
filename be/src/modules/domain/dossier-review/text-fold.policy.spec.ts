import { Test } from "@nestjs/testing"
import { foldKeepLength, foldText } from "./text-fold.policy"

const SUBJECT = Symbol("text-fold.policy")
type Subject = {
    foldText: typeof foldText
    foldKeepLength: typeof foldKeepLength
}
const subjectOf = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { foldText, foldKeepLength } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("foldText", () => {
    it("removes accents, folds the stroked d, lowers case and collapses whitespace", async () => {
        const subject = await subjectOf()
        expect(subject.foldText("  V\u1ed1n  \u0110I\u1ec0U   L\u1ec6 ")).toBe("von dieu le")
    })

    it("keeps one character per input character so indexes line up", async () => {
        const subject = await subjectOf()
        const text = "\u0110i\u1ec1u l\u1ec7"
        expect(subject.foldKeepLength(text)).toHaveLength(text.length)
        expect(subject.foldKeepLength(text)).toBe("dieu le")
    })
})
