import { removedTitle } from "./knowledge-source-projection"

describe("knowledge source projection", () => {
    it("reads the title a delete answered", () => {
        expect(removedTitle([{ title: "Menu" }])).toBe("Menu")
    })

    it.each([[[]], [undefined], [[null]], [[{ title: 5 }]], [["text"]]])(
        "answers nothing for the raw result %j",
        (raw) => {
            expect(removedTitle(raw)).toBeUndefined()
        },
    )
})
