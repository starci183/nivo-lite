import type { EntityDefinition, IndexDef } from "../entity/entity.types"
import { equalityFieldsOf, isIndexed } from "./index-prefix"
import { q } from "./q"
import { LEAD, OWNER } from "./query.fixture"
import type { OrderBy } from "./query.types"

const RECENT: OrderBy = [
    ["updatedAt", "desc"],
    ["id", "desc"],
]

const withIndexes = (indexes: ReadonlyArray<IndexDef>): EntityDefinition => ({ ...LEAD, indexes })

describe("equalityFieldsOf", () => {
    it("takes the literal equalities of the top-level conjunction", () => {
        expect(equalityFieldsOf(undefined)).toEqual([])
        expect(equalityFieldsOf(q.eq("stage", "won"))).toEqual(["stage"])
        expect(
            equalityFieldsOf(q.and(q.eq("stage", "won"), q.and(q.eq("channel", "zalo"), q.lt("amountVnd", 1)))),
        ).toEqual(["stage", "channel"])
    })

    it("leaves out what is not a literal equality", () => {
        expect(equalityFieldsOf(q.eq("stage", null))).toEqual([])
        expect(equalityFieldsOf(q.eqRef("startsAt", "endsAt"))).toEqual([])
        expect(equalityFieldsOf(q.or(q.eq("stage", "won")))).toEqual([])
        expect(equalityFieldsOf(q.ne("stage", "won"))).toEqual([])
    })
})

describe("isIndexed", () => {
    it("accepts an order that is a prefix of a declared index", () => {
        expect(isIndexed(LEAD, undefined, RECENT)).toBe(true)
        expect(
            isIndexed(LEAD, undefined, [
                ["createdAt", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(true)
        expect(
            isIndexed(LEAD, undefined, [
                ["data.tier", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(true)
    })

    it("reads an index backward", () => {
        expect(
            isIndexed(LEAD, undefined, [
                ["createdAt", "desc"],
                ["id", "desc"],
            ]),
        ).toBe(true)
        expect(
            isIndexed(LEAD, undefined, [
                ["updatedAt", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(true)
    })

    it("refuses a mixed direction", () => {
        expect(
            isIndexed(LEAD, undefined, [
                ["createdAt", "asc"],
                ["id", "desc"],
            ]),
        ).toBe(false)
        expect(
            isIndexed(LEAD, undefined, [
                ["createdAt", "desc"],
                ["id", "asc"],
            ]),
        ).toBe(false)
    })

    it("puts the equality fields between the workspace and the order", () => {
        expect(isIndexed(LEAD, q.eq("stage", "won"), RECENT)).toBe(true)
        expect(isIndexed(LEAD, q.and(q.eq("stage", "won"), q.eq("stage", "won")), RECENT)).toBe(true)
        expect(isIndexed(LEAD, q.eq("channel", "zalo"), RECENT)).toBe(false)
        expect(isIndexed(LEAD, q.and(q.eq("stage", "won"), q.eq("channel", "zalo")), RECENT)).toBe(false)
    })

    it("counts a field both pinned and ordered once", () => {
        expect(
            isIndexed(LEAD, q.eq("createdAt", "x"), [
                ["createdAt", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(true)
    })

    it("refuses an order longer than the index", () => {
        expect(isIndexed(LEAD, undefined, [...RECENT, ["createdAt", "desc"]])).toBe(false)
        expect(
            isIndexed(LEAD, undefined, [
                ["amountVnd", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(false)
    })

    it("ignores folded, partial and non-btree indexes", () => {
        expect(
            isIndexed(LEAD, undefined, [
                ["contactName", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(false)
        expect(
            isIndexed(LEAD, undefined, [
                ["channel", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(false)
        expect(
            isIndexed(LEAD, undefined, [
                ["data", "asc"],
                ["id", "asc"],
            ]),
        ).toBe(false)
    })

    it("accepts an index that says btree", () => {
        expect(isIndexed(withIndexes([{ name: "x", on: ["id"], using: "btree" }]), undefined, [["id", "asc"]])).toBe(
            true,
        )
    })

    it("needs enough parts for the equality fields", () => {
        expect(isIndexed(withIndexes([{ name: "x", on: [] }]), q.eq("stage", "won"), [["id", "asc"]])).toBe(false)
        expect(isIndexed(withIndexes([]), undefined, [["id", "asc"]])).toBe(false)
        expect(isIndexed(OWNER, undefined, [["id", "asc"]])).toBe(false)
    })
})
