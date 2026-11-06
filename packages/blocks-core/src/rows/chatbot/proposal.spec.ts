import { proposalOf } from "./proposal"

describe("proposalOf", () => {
    const paths = { idPath: "id", textPath: "text", askedPath: "asked", notePath: "note" }

    it("reads the proposal with what was asked and the note", () => {
        expect(proposalOf({ id: "p1", text: "Hello", asked: "Open?", note: "Via Zalo" }, paths)).toEqual({
            id: "p1",
            text: "Hello",
            asked: "Open?",
            note: "Via Zalo",
        })
    })

    it("leaves the optional lines empty when no path names them", () => {
        expect(proposalOf({ id: 7, text: "Hello" }, { idPath: "id", textPath: "text" })).toEqual({
            id: "7",
            text: "Hello",
            asked: "",
            note: "",
        })
    })

    it("draws no proposal without an id or without words", () => {
        expect(proposalOf({ text: "Hello" }, paths)).toBeNull()
        expect(proposalOf({ id: "p1", text: "" }, paths)).toBeNull()
        expect(proposalOf(undefined, paths)).toBeNull()
    })
})
