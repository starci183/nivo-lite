import { detailBlock } from "./detail.block"
import { LABEL_PATHS_MAX, LABEL_VALUE_MAX, LABEL_VALUES_MAX, labelsProp } from "./labels-prop"
import { recordListBlock } from "./record-list.block"
import { tableBlock } from "./table.block"

const WORD = { key: "word" }
const LABELS = { stage: { won: WORD, lost: { vi: "Mat", en: "Lost" } } }
const manyValues = (count: number): Record<string, typeof WORD> =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`v${index}`, WORD]))

describe("labelsProp", () => {
    it("takes words for the values of a path", () => {
        expect(labelsProp.safeParse(LABELS).success).toBe(true)
        expect(labelsProp.safeParse({}).success).toBe(true)
    })

    it("refuses a value without words, an empty or oversized value, and an oversized path", () => {
        expect(labelsProp.safeParse({ stage: { won: "Won" } }).success).toBe(false)
        expect(labelsProp.safeParse({ stage: { "": WORD } }).success).toBe(false)
        expect(labelsProp.safeParse({ stage: { ["v".repeat(LABEL_VALUE_MAX + 1)]: WORD } }).success).toBe(false)
        expect(labelsProp.safeParse({ ["p".repeat(201)]: { won: WORD } }).success).toBe(false)
        expect(labelsProp.safeParse({ "": { won: WORD } }).success).toBe(false)
    })

    it("refuses more values per path and more paths than the bounds", () => {
        expect(labelsProp.safeParse({ stage: manyValues(LABEL_VALUES_MAX) }).success).toBe(true)
        expect(labelsProp.safeParse({ stage: manyValues(LABEL_VALUES_MAX + 1) }).success).toBe(false)
        const paths = (count: number): Record<string, typeof LABELS.stage> =>
            Object.fromEntries(Array.from({ length: count }, (_, index) => [`p${index}`, LABELS.stage]))
        expect(labelsProp.safeParse(paths(LABEL_PATHS_MAX)).success).toBe(true)
        expect(labelsProp.safeParse(paths(LABEL_PATHS_MAX + 1)).success).toBe(false)
    })
})

describe("the blocks that draw a raw value", () => {
    it("take labels on the record list, the table and the detail", () => {
        const list = { label: WORD, empty: WORD, idPath: "id", titlePath: "name", badgePath: "stage", labels: LABELS }
        const table = {
            label: WORD,
            empty: WORD,
            idPath: "id",
            columns: [{ term: WORD, path: "stage" }],
            labels: LABELS,
        }
        const detail = { label: WORD, items: [{ term: WORD, path: "stage", format: "badge" }], labels: LABELS }
        expect(recordListBlock.props.safeParse(list).success).toBe(true)
        expect(tableBlock.props.safeParse(table).success).toBe(true)
        expect(detailBlock.props.safeParse(detail).success).toBe(true)
    })

    it("refuse labels that are unbounded", () => {
        const table = {
            label: WORD,
            empty: WORD,
            idPath: "id",
            columns: [{ term: WORD, path: "stage" }],
            labels: { stage: manyValues(LABEL_VALUES_MAX + 1) },
        }
        expect(tableBlock.props.safeParse(table).success).toBe(false)
    })
})
