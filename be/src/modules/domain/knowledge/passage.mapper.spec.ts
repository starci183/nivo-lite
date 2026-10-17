import { Test } from "@nestjs/testing"
import { toPassage } from "./passage.mapper"

const SUBJECT = Symbol("passage.mapper")
type Subject = { toPassage: typeof toPassage }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toPassage } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("toPassage", () => {
    it("renames the columns of a search row", async () => {
        const subject = await build()

        expect(
            subject.toPassage({
                layer: "business",
                id: "c1",
                source_id: "s1",
                module: "chatbot",
                kind: "faq",
                title: "Hours",
                content: "Open 8 to 21",
                score: 0.5,
                visibility: "public",
                topic: "hours",
            }),
        ).toEqual({
            layer: "business",
            id: "c1",
            sourceId: "s1",
            module: "chatbot",
            kind: "faq",
            title: "Hours",
            content: "Open 8 to 21",
            score: 0.5,
            visibility: "public",
            topic: "hours",
        })
    })
})
