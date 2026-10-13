import { clampPageSize, splitPage } from "./paging.policy"

describe("clampPageSize", () => {
    it.each([
        [20, 20],
        [0, 1],
        [-5, 1],
        [500, 100],
        [7.9, 7],
        [Number.NaN, 1],
    ])("turns %s into %s", (requested, expected) => {
        expect(clampPageSize(requested)).toBe(expected)
    })
})

describe("splitPage", () => {
    const rowOf = (id: string) => ({ id, cursor_at: `at-${id}` })

    it("cuts the extra row off and points at the last row kept", () => {
        expect(splitPage([rowOf("a"), rowOf("b"), rowOf("c")], 2)).toEqual({
            rows: [rowOf("a"), rowOf("b")],
            next: { createdAt: "at-b", id: "b" },
        })
    })

    it("has no next page when the rows fit", () => {
        expect(splitPage([rowOf("a"), rowOf("b")], 2)).toEqual({ rows: [rowOf("a"), rowOf("b")], next: null })
    })

    it("has no next page for no rows", () => {
        expect(splitPage([], 2)).toEqual({ rows: [], next: null })
    })

    it("has no next page for a zero-size page", () => {
        expect(splitPage([rowOf("a")], 0)).toEqual({ rows: [], next: null })
    })
})
