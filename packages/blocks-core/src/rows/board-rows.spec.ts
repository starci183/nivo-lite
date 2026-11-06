import { keepRaw } from "./value-labels"
import {
    announceOf,
    BOARD_PLACEHOLDER,
    boardCardsOf,
    boardColumnsOf,
    unsettledMoves,
    withMove,
    withoutMove,
} from "./board-rows"

const PATHS = {
    idPath: "id",
    titlePath: "name",
    groupBy: "stage",
    descriptionPath: "note",
    badgePath: "tag",
    metaPath: "when",
}
const SPECS = [
    { value: "new", label: "New" },
    { value: "won", label: "Won" },
]
const records = [
    { id: "a", name: "Ann", note: "n", tag: "hot", when: "2 min", stage: "new" },
    { id: 2, name: "Bob", stage: "won" },
    { name: "No id", stage: "new" },
]

describe("boardCardsOf", () => {
    it("makes a card per record read through the paths, and skips a record without a text id", () => {
        expect(boardCardsOf(records, PATHS, keepRaw)).toEqual([
            { id: "a", title: "Ann", description: "n", badge: "hot", meta: "2 min", column: "new" },
            { id: "2", title: "Bob", description: "", badge: "", meta: "", column: "won" },
        ])
    })

    it("draws no optional part when its path is absent, and reads no cards as an empty slot", () => {
        expect(boardCardsOf(records, { idPath: "id", titlePath: "name", groupBy: "stage" }, keepRaw)?.[0]).toEqual({
            id: "a",
            title: "Ann",
            description: "",
            badge: "",
            meta: "",
            column: "new",
        })
        expect(boardCardsOf([], PATHS, keepRaw)).toBeNull()
        expect(BOARD_PLACEHOLDER).toEqual([])
    })
})

describe("boardColumnsOf", () => {
    const cards = boardCardsOf(records, PATHS, keepRaw) ?? []

    it("puts each card in the column its field names and counts them when every card is known", () => {
        const columns = boardColumnsOf(cards, SPECS, {}, false)
        expect(columns.map((column) => [column.value, column.cards.map((card) => card.id), column.count])).toEqual([
            ["new", ["a"], 1],
            ["won", ["2"], 1],
        ])
    })

    it("leaves the count out while more cards may load, and shows a pending move in its new column", () => {
        const columns = boardColumnsOf(cards, SPECS, { a: "won" }, true)
        expect(columns.map((column) => column.count)).toEqual([undefined, undefined])
        expect(columns[1]?.cards.map((card) => card.id)).toEqual(["a", "2"])
    })
})

describe("the pending moves", () => {
    const cards = boardCardsOf(records, PATHS, keepRaw) ?? []

    it("adds a move and takes it back", () => {
        const moved = withMove({}, "a", "won")
        expect(moved).toEqual({ a: "won" })
        expect(withoutMove(moved, "a")).toEqual({})
        expect(withoutMove(moved, "other")).toEqual({ a: "won" })
    })

    it("keeps a move until the read puts the card in the new column", () => {
        expect(unsettledMoves({ a: "won" }, cards)).toEqual({ a: "won" })
        expect(unsettledMoves({ a: "new" }, cards)).toEqual({})
        expect(unsettledMoves({ gone: "won" }, cards)).toEqual({})
    })
})

describe("announceOf", () => {
    it("fills the item and the column into the message", () => {
        expect(announceOf("Moved {item} to {column}", "Ann", "Won")).toBe("Moved Ann to Won")
    })
})
