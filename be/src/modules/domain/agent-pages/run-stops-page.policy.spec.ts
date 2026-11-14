import { DEPTH_MAX, offsetOf, sizeOf } from "./run-stops-page.policy"

describe("offsetOf", () => {
    it.each([
        [undefined, 0],
        [null, 0],
        ["", 0],
        ["0", 0],
        ["-3", 0],
        ["2", 2],
        ["abc", 0],
        ["1.5", 0],
        ["100", DEPTH_MAX],
        ["5000", DEPTH_MAX],
    ])("reads the cursor %j as the position %d", (cursor, expected) => {
        expect(offsetOf(cursor)).toBe(expected)
    })
})

describe("sizeOf", () => {
    it.each([
        [undefined, 20],
        [null, 20],
        [0, 1],
        [-5, 1],
        [1, 1],
        [7, 7],
        [50, 50],
        [51, 50],
        [1_000, 50],
    ])("asks a page of %j stops and gets %d", (limit, expected) => {
        expect(sizeOf(limit)).toBe(expected)
    })
})
