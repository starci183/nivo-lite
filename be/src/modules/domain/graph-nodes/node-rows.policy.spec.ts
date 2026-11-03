import { rowsAnswering } from "./node-rows.policy"

const ROWS = [
    { id: "a", name: "Tea", price: 10, secret: "x" },
    { id: "b", name: "Cake", price: 20, secret: "y" },
    { id: "c", name: "Tea", price: 30, secret: "z" },
]

describe("rowsAnswering", () => {
    it("keeps the rows that match every entry of where, cut to the fields asked for", () => {
        expect(rowsAnswering(ROWS, { where: { name: "Tea", price: 30 }, fields: ["id", "price"] })).toEqual([
            { id: "c", price: 30 },
        ])
    })

    it("answers null for a field the row lacks and never leaks a field that was not asked", () => {
        const [row] = rowsAnswering([{ id: "a" }], { fields: ["id", "missing"] })

        expect(row).toEqual({ id: "a", missing: null })
        expect(Object.keys(rowsAnswering(ROWS, { fields: ["id"] })[0] ?? {})).toEqual(["id"])
    })

    it("stops at the limit, and at fifty rows when none is named", () => {
        expect(rowsAnswering(ROWS, { fields: ["id"], limit: 2 })).toHaveLength(2)
        const many = Array.from({ length: 80 }, (_, index) => ({ id: String(index) }))
        expect(rowsAnswering(many, { fields: ["id"] })).toHaveLength(50)
    })
})
