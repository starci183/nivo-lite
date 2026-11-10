import { keyedRows } from "./agent-message-rows"

describe("keyedRows", () => {
    it("gives identical rows different keys and keeps the order", () => {
        const rows = keyedRows([
            ["a", "1"],
            ["b", "2"],
            ["a", "1"],
        ])
        expect(rows.map((row) => row.key)).toEqual(["a|1#0", "b|2#0", "a|1#1"])
        expect(rows[2]?.cells).toEqual(["a", "1"])
    })

    it("answers nothing for no rows", () => {
        expect(keyedRows([])).toEqual([])
    })
})
