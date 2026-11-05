import { q } from "./q"
import { LEAD } from "./query.fixture"

describe("q filters", () => {
    it("builds the comparisons with a value", () => {
        expect(q.eq("stage", "won")).toEqual({ op: "eq", field: "stage", value: "won" })
        expect(q.ne("stage", "won")).toEqual({ op: "ne", field: "stage", value: "won" })
        expect(q.lt("amountVnd", 1)).toEqual({ op: "lt", field: "amountVnd", value: 1 })
        expect(q.lte("amountVnd", 1)).toEqual({ op: "lte", field: "amountVnd", value: 1 })
        expect(q.gt("amountVnd", 1)).toEqual({ op: "gt", field: "amountVnd", value: 1 })
        expect(q.gte("amountVnd", 1)).toEqual({ op: "gte", field: "amountVnd", value: 1 })
    })

    it("builds the comparisons with another field", () => {
        expect(q.eqRef("a", "b")).toEqual({ op: "eq", field: "a", ref: "b" })
        expect(q.neRef("a", "b")).toEqual({ op: "ne", field: "a", ref: "b" })
        expect(q.ltRef("a", "b")).toEqual({ op: "lt", field: "a", ref: "b" })
        expect(q.lteRef("a", "b")).toEqual({ op: "lte", field: "a", ref: "b" })
        expect(q.gtRef("a", "b")).toEqual({ op: "gt", field: "a", ref: "b" })
        expect(q.gteRef("a", "b")).toEqual({ op: "gte", field: "a", ref: "b" })
    })

    it("builds membership, null checks, search and overlap", () => {
        expect(q.in("stage", ["a"])).toEqual({ op: "in", field: "stage", values: ["a"] })
        expect(q.notIn("stage", ["a"])).toEqual({ op: "notIn", field: "stage", values: ["a"] })
        expect(q.isNull("ownerId")).toEqual({ op: "isNull", field: "ownerId" })
        expect(q.notNull("ownerId")).toEqual({ op: "notNull", field: "ownerId" })
        expect(q.search(["contactName"], "dinh")).toEqual({ op: "search", fields: ["contactName"], text: "dinh" })
        expect(q.overlaps(["startsAt", "endsAt"], "a", "b")).toEqual({
            op: "overlaps",
            range: ["startsAt", "endsAt"],
            from: "a",
            to: "b",
        })
    })

    it("builds the combinators and has", () => {
        const one = q.isNull("ownerId")
        expect(q.and(one, one)).toEqual({ op: "and", of: [one, one] })
        expect(q.or(one)).toEqual({ op: "or", of: [one] })
        expect(q.not(one)).toEqual({ op: "not", of: one })
        expect(q.has("messages")).toEqual({ op: "has", relation: "messages" })
        expect(q.has("messages", one)).toEqual({ op: "has", relation: "messages", where: one })
    })

    it("and-s only the parts that are present", () => {
        const one = q.isNull("ownerId")
        const two = q.notNull("channel")
        expect(q.allOf()).toBeUndefined()
        expect(q.allOf(undefined)).toBeUndefined()
        expect(q.allOf(undefined, one)).toBe(one)
        expect(q.allOf(one, undefined, two)).toEqual({ op: "and", of: [one, two] })
    })
})

describe("q.list", () => {
    it("builds a query through the steps", () => {
        const where = q.eq("stage", "won")
        const tree = q
            .list(LEAD)
            .select("id", "stage")
            .select("contactName")
            .join("owner", "name")
            .include({ relation: "messages", select: ["body"], order: [["id", "desc"]], latest: 3 })
            .where(where)
            .order(["updatedAt", "desc"], ["id", "desc"])
            .page(20, "cursor")
        expect(tree).toEqual({
            from: "sales.lead",
            select: ["id", "stage", "contactName"],
            join: { owner: ["name"] },
            include: [{ relation: "messages", select: ["body"], order: [["id", "desc"]], latest: 3 }],
            where,
            order: [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 20, after: "cursor" },
        })
    })

    it("and-s a second where and leaves out what was not given", () => {
        const first = q.eq("stage", "won")
        const second = q.notNull("channel")
        const tree = q.list(LEAD).select("id").where(first).where(second).order(["id", "asc"]).page(5)
        expect(tree).toEqual({
            from: "sales.lead",
            select: ["id"],
            where: { op: "and", of: [first, second] },
            order: [["id", "asc"]],
            page: { size: 5 },
        })
    })

    it("does not change the builder it was called on", () => {
        const base = q.list(LEAD).select("id")
        base.select("stage")
        expect(base.order(["id", "asc"]).page(1).select).toEqual(["id"])
    })
})
