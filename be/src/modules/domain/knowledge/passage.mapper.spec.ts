import { toPassage } from "./passage.mapper"

describe("toPassage", () => {
    it("renames the columns of a search row", () => {
        expect(
            toPassage({
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
