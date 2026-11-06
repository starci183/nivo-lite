import { LIST_PANE_ROWS_PROPS } from "../fixtures/list-pane.fixtures"
import { recordListBlock } from "./record-list.block"

const WORD = { key: "word" }
const LIST = { label: WORD, empty: WORD, idPath: "id", titlePath: "title" }

describe("the selection and search props of the record list", () => {
    it("stay optional, so a card list without a param still parses", () => {
        expect(recordListBlock.props.safeParse(LIST).success).toBe(true)
    })

    it("take the selection param, the search param and the words of an empty search", () => {
        expect(recordListBlock.props.safeParse(LIST_PANE_ROWS_PROPS).success).toBe(true)
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

describe("the row commands of the record list", () => {
    const ACTIONS = [
        { slot: "action1", key: "reply", label: WORD, intent: "commit" },
        { slot: "action2" },
        { slot: "action3", key: "retry", intent: "danger" },
    ]

    it("take a choice field and up to four commands, each on its own slot", () => {
        expect(recordListBlock.props.safeParse({ ...LIST, actionPath: "next", actions: ACTIONS }).success).toBe(true)
        expect(recordListBlock.props.safeParse({ ...LIST, actions: [] }).success).toBe(true)
        expect(Object.keys(recordListBlock.slots)).toEqual(["rows", "open", "action1", "action2", "action3", "action4"])
    })

    it("keep the single open action working next to them", () => {
        expect(recordListBlock.slots.open).toEqual({ kind: "action", required: false })
    })

    it.each([
        ["an unknown slot", [{ slot: "action5" }]],
        ["a slot used twice", [{ slot: "action1" }, { slot: "action1", key: "again" }]],
        [
            "a key used twice",
            [
                { slot: "action1", key: "x" },
                { slot: "action2", key: "x" },
            ],
        ],
        ["a key that is a slot name another command has", [{ slot: "action1", key: "action2" }, { slot: "action2" }]],
        ["the key of the open action", [{ slot: "action1", key: "open" }]],
        ["an empty key", [{ slot: "action1", key: "" }]],
        ["an intent it does not know", [{ slot: "action1", intent: "loud" }]],
        ["more than four commands", Array.from({ length: 5 }, (_, index) => ({ slot: `action${index + 1}` }))],
    ])("refuse %s", (_name, actions) => {
        expect(recordListBlock.props.safeParse({ ...LIST, actions }).success).toBe(false)
    })
})
