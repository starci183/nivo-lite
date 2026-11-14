import {
    CLIP_SECONDS_MAX,
    VIDEO_DEFAULT_SECONDS,
    VIDEO_MAX_SECONDS,
    VIDEO_MIN_SECONDS,
    aspectOf,
    clipSecondsOf,
    goalOf,
    normaliseColor,
    spokenSecondsOf,
    targetSecondsOf,
} from "./spec"

describe("normaliseColor", () => {
    it.each([
        ["#ABC", "#aabbcc"],
        ["abc", "#aabbcc"],
        [" #16A34A ", "#16a34a"],
        ["#1234", null],
        ["red", null],
        [12, null],
        [null, null],
    ])("reads %j as %j", (value, expected) => {
        expect(normaliseColor(value)).toBe(expected)
    })
})

describe("aspectOf and goalOf", () => {
    it("keeps a known shape or goal and falls back to vertical and custom", () => {
        expect(aspectOf("16:9")).toBe("16:9")
        expect(aspectOf("4:3")).toBe("9:16")
        expect(goalOf("offer")).toBe("offer")
        expect(goalOf("unknown")).toBe("custom")
        expect(goalOf(undefined)).toBe("custom")
    })
})

describe("targetSecondsOf", () => {
    it.each([
        [30, 30],
        [5, VIDEO_MIN_SECONDS],
        [500, VIDEO_MAX_SECONDS],
        [12.6, 13],
        ["20", VIDEO_DEFAULT_SECONDS],
        [Number.NaN, VIDEO_DEFAULT_SECONDS],
    ])("keeps %j inside the bounds as %j", (value, expected) => {
        expect(targetSecondsOf(value)).toBe(expected)
    })
})

describe("clip lengths", () => {
    it("plans no voice for blank words and about 14 characters a second otherwise", () => {
        expect(spokenSecondsOf("  ")).toBe(0)
        expect(spokenSecondsOf("a".repeat(28))).toBeCloseTo(2.8)
    })

    it("takes the shortest clip that holds the words, else the longest", () => {
        expect(clipSecondsOf("")).toBe(4)
        expect(clipSecondsOf("a".repeat(40))).toBe(4)
        expect(clipSecondsOf("a".repeat(60))).toBe(6)
        expect(clipSecondsOf("a".repeat(100))).toBe(8)
        expect(clipSecondsOf("a".repeat(400))).toBe(CLIP_SECONDS_MAX)
    })
})
