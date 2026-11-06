import { recordListBlock } from "./record-list.block"

const WORD = { key: "word" }
const LIST = { label: WORD, empty: WORD, idPath: "id", titlePath: "title" }

describe("the selection and search props of the record list", () => {
    it("stay optional, so a card list without a param still parses", () => {
        expect(recordListBlock.props.safeParse(LIST).success).toBe(true)
    })

    it("take the selection param, the search param and the words of an empty search", () => {
        expect(
            recordListBlock.props.safeParse({ ...LIST, selectParam: "selected", searchParam: "q", emptySearch: WORD })
                .success,
        ).toBe(true)
    })

    it("refuse an empty param name or one past its bound", () => {
        expect(recordListBlock.props.safeParse({ ...LIST, selectParam: "" }).success).toBe(false)
        expect(recordListBlock.props.safeParse({ ...LIST, searchParam: "q".repeat(65) }).success).toBe(false)
    })
})
