import {
    clip,
    deriveSku,
    isEmailAddress,
    isIsoDay,
    isUuid,
    parseCommaList,
    parseUnitPairs,
    uuidOrNull,
} from "./input-text.policy"

const UUID = "0b8c1f0e-3a49-4b7e-9d3f-2c1f6a5d7e90"

describe("clip", () => {
    it("trims and cuts to the maximum", () => {
        expect(clip("  abcdef  ", 4)).toBe("abcd")
    })
})

describe("isUuid and uuidOrNull", () => {
    it("recognise a UUID in any case", () => {
        expect(isUuid(UUID)).toBe(true)
        expect(isUuid(UUID.toUpperCase())).toBe(true)
        expect(isUuid("not-a-uuid")).toBe(false)
    })

    it("answers the value only when it is a UUID", () => {
        expect(uuidOrNull(UUID)).toBe(UUID)
        expect(uuidOrNull("x")).toBeNull()
        expect(uuidOrNull(undefined)).toBeNull()
    })
})

describe("isIsoDay", () => {
    it("accepts a day and refuses anything else", () => {
        expect(isIsoDay("2026-10-12")).toBe(true)
        expect(isIsoDay("12/10/2026")).toBe(false)
    })
})

describe("isEmailAddress", () => {
    it("accepts something shaped like an address", () => {
        expect(isEmailAddress("a@b.vn")).toBe(true)
        expect(isEmailAddress("a@b")).toBe(false)
        expect(isEmailAddress("a b@c.vn")).toBe(false)
    })
})

describe("parseUnitPairs", () => {
    it("reads unit=factor pairs separated by commas, semicolons or line breaks", () => {
        expect(parseUnitPairs("box=24, pack=6;crate=100\nbad=0")).toEqual([
            { unit: "box", factor: 24 },
            { unit: "pack", factor: 6 },
            { unit: "crate", factor: 100 },
        ])
    })

    it("drops a pair with no name, no factor or a factor that is not positive", () => {
        expect(parseUnitPairs("=5, loose, kg=x, bag=-1")).toEqual([])
    })

    it("cuts a long unit name", () => {
        const [pair] = parseUnitPairs(`${"u".repeat(40)}=2`)
        expect(pair?.unit).toHaveLength(30)
    })
})

describe("parseCommaList", () => {
    it("splits, trims and drops blanks", () => {
        expect(parseCommaList(" a, b ;; c\n d ")).toEqual(["a", "b", "c", "d"])
    })

    it("keeps at most twenty entries", () => {
        expect(parseCommaList(Array.from({ length: 25 }, (_unused, index) => `n${index}`).join(","))).toHaveLength(20)
    })
})

describe("deriveSku", () => {
    it("upper-cases and dashes the name", () => {
        expect(deriveSku("Green tea")).toBe("GREEN-TEA")
    })

    it("cuts to twenty characters", () => {
        expect(deriveSku("a".repeat(30))).toBe("A".repeat(20))
    })

    it("falls back to a fixed code when the name has no letters", () => {
        expect(deriveSku("!!!")).toBe("ITEM")
    })
})
