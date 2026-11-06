import { countedWords } from "./counted-words"

describe("countedWords", () => {
    it("puts the number where the message asks for it, every time", () => {
        expect(countedWords("{count} items of {count}", 4)).toBe("4 items of 4")
    })

    it("leaves a message with no place for a number as it is", () => {
        expect(countedWords("Nothing", 4)).toBe("Nothing")
    })
})
