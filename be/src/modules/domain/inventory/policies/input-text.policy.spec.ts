import { Test } from "@nestjs/testing"
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

const SUBJECT = Symbol("input-text.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    clip,
                    isUuid,
                    uuidOrNull,
                    isIsoDay,
                    isEmailAddress,
                    parseUnitPairs,
                    parseCommaList,
                    deriveSku,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./input-text.policy")>(SUBJECT)
}

const UUID = "0b8c1f0e-3a49-4b7e-9d3f-2c1f6a5d7e90"

describe("clip", () => {
    it("trims and cuts to the maximum", async () => {
        const subject = await buildSubject()

        expect(subject.clip("  abcdef  ", 4)).toBe("abcd")
    })
})

describe("isUuid and uuidOrNull", () => {
    it("recognise a UUID in any case", async () => {
        const subject = await buildSubject()

        expect(subject.isUuid(UUID)).toBe(true)
        expect(subject.isUuid(UUID.toUpperCase())).toBe(true)
        expect(subject.isUuid("not-a-uuid")).toBe(false)
    })

    it("answers the value only when it is a UUID", async () => {
        const subject = await buildSubject()

        expect(subject.uuidOrNull(UUID)).toBe(UUID)
        expect(subject.uuidOrNull("x")).toBeNull()
        expect(subject.uuidOrNull(undefined)).toBeNull()
    })
})

describe("isIsoDay", () => {
    it("accepts a day and refuses anything else", async () => {
        const subject = await buildSubject()

        expect(subject.isIsoDay("2026-10-12")).toBe(true)
        expect(subject.isIsoDay("12/10/2026")).toBe(false)
    })
})

describe("isEmailAddress", () => {
    it("accepts something shaped like an address", async () => {
        const subject = await buildSubject()

        expect(subject.isEmailAddress("a@b.vn")).toBe(true)
        expect(subject.isEmailAddress("a@b")).toBe(false)
        expect(subject.isEmailAddress("a b@c.vn")).toBe(false)
    })
})

describe("parseUnitPairs", () => {
    it("reads unit=factor pairs separated by commas, semicolons or line breaks", async () => {
        const subject = await buildSubject()

        expect(subject.parseUnitPairs("box=24, pack=6;crate=100\nbad=0")).toEqual([
            { unit: "box", factor: 24 },
            { unit: "pack", factor: 6 },
            { unit: "crate", factor: 100 },
        ])
    })

    it("drops a pair with no name, no factor or a factor that is not positive", async () => {
        const subject = await buildSubject()

        expect(subject.parseUnitPairs("=5, loose, kg=x, bag=-1")).toEqual([])
    })

    it("cuts a long unit name", async () => {
        const subject = await buildSubject()

        const [pair] = subject.parseUnitPairs(`${"u".repeat(40)}=2`)
        expect(pair?.unit).toHaveLength(30)
    })
})

describe("parseCommaList", () => {
    it("splits, trims and drops blanks", async () => {
        const subject = await buildSubject()

        expect(subject.parseCommaList(" a, b ;; c\n d ")).toEqual(["a", "b", "c", "d"])
    })

    it("keeps at most twenty entries", async () => {
        const subject = await buildSubject()

        expect(
            subject.parseCommaList(Array.from({ length: 25 }, (_unused, index) => `n${index}`).join(",")),
        ).toHaveLength(20)
    })
})

describe("deriveSku", () => {
    it("upper-cases and dashes the name", async () => {
        const subject = await buildSubject()

        expect(subject.deriveSku("Green tea")).toBe("GREEN-TEA")
    })

    it("cuts to twenty characters", async () => {
        const subject = await buildSubject()

        expect(subject.deriveSku("a".repeat(30))).toBe("A".repeat(20))
    })

    it("falls back to a fixed code when the name has no letters", async () => {
        const subject = await buildSubject()

        expect(subject.deriveSku("!!!")).toBe("ITEM")
    })
})

describe("email address shape boundaries", () => {
    it.each<[string, boolean]>([
        ["a@b.c.", true],
        ["a@.b.c", true],
        ["a@b..", true],
        ["a@.b", false],
        ["a@b.", false],
        ["a@@b.c", false],
        ["a@b.c\n", false],
        ["a@" + "b".repeat(20000), false],
    ])("validates %s without changing the existing shape", async (value, expected) => {
        const subject = await buildSubject()
        expect(subject.isEmailAddress(value)).toBe(expected)
    })
})
