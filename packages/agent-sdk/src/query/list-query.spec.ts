import { countsOf, listQueryOf } from "./list-query"
import type { FilterCase, ListQuery, ListShape } from "../block/list.types"
import { q } from "./q"
import { QueryBuildError } from "./query-error"
import { queryProblems } from "./query-problems"
import { CATALOG, LEAD, LEAD_SHAPE, PLAIN_SHAPE } from "./query.fixture"

const BASE: ListQuery = { q: null, filters: {}, sort: "recent", cursor: null, size: 20 }
const query = (patch: Partial<ListQuery>): ListQuery => ({ ...BASE, ...patch })

/** The code of the QueryBuildError a call throws. */
function codeOf(call: () => unknown): string {
    try {
        call()
    } catch (error) {
        return error instanceof QueryBuildError ? `${error.code}: ${error.at}` : "other"
    }
    return "none"
}

describe("listQueryOf", () => {
    it("selects the row fields and sorts by the chosen sort", () => {
        const tree = listQueryOf(LEAD, LEAD_SHAPE, BASE)
        expect(tree).toEqual({
            from: "sales.lead",
            select: ["id", "contactName", "channel", "stage", "updatedAt"],
            order: [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 20 },
        })
        expect(queryProblems(tree, CATALOG)).toEqual([])
    })

    it("ends a sort that lacks the key with the key", () => {
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ sort: "name" })).order).toEqual([
            ["contactName", "asc"],
            ["id", "asc"],
        ])
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ sort: "bare" })).order).toEqual([["id", "asc"]])
    })

    it("leaves out the optional row fields a shape does not declare", () => {
        const shape: ListShape = { ...LEAD_SHAPE, row: { id: "id", title: "contactName" } }
        expect(listQueryOf(LEAD, shape, BASE).select).toEqual(["id", "contactName", "updatedAt"])
    })

    it("adds the fields the caller asks for once", () => {
        const tree = listQueryOf(LEAD, LEAD_SHAPE, BASE, { select: ["amountVnd", "stage"] })
        expect(tree.select).toEqual(["id", "contactName", "channel", "stage", "updatedAt", "amountVnd"])
    })

    it("searches the trimmed text, cut to 200 characters", () => {
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ q: "  dinh " })).where).toEqual(q.search(["contactName"], "dinh"))
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ q: "a".repeat(300) })).where).toEqual(
            q.search(["contactName"], "a".repeat(200)),
        )
    })

    it("does not search without text or without searchable fields", () => {
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ q: "   " })).where).toBeUndefined()
        expect(listQueryOf(LEAD, PLAIN_SHAPE, query({ q: "dinh" })).where).toBeUndefined()
    })

    it("turns a chosen time window into a half-open range on the field, and refuses a window for a filter that names none", () => {
        const shape: ListShape = {
            ...LEAD_SHAPE,
            filters: { ...LEAD_SHAPE.filters, when: { field: "updatedAt", op: "within", of: ["$today"] } },
        }
        const window = { from: "2026-11-06T00:00:00.000Z", to: "2026-11-07T00:00:00.000Z" }
        expect(listQueryOf(LEAD, shape, query({ windows: { when: window } })).where).toEqual(
            q.and(q.gte("updatedAt", window.from), q.lt("updatedAt", window.to)),
        )
        expect(codeOf(() => listQueryOf(LEAD, shape, query({ windows: { stage: window } })))).toBe(
            "LIST_FILTER_VALUE_UNKNOWN: stage is not a window filter",
        )
        expect(codeOf(() => listQueryOf(LEAD, shape, query({ windows: { cases: window } })))).toBe(
            "LIST_FILTER_UNKNOWN: cases",
        )
    })

    it("takes any value of an open filter, not only the values it lists", () => {
        const shape: ListShape = {
            ...LEAD_SHAPE,
            filters: { ...LEAD_SHAPE.filters, tier: { field: "channel", op: "eq", of: ["gold"], open: true } },
        }
        expect(listQueryOf(LEAD, shape, query({ filters: { tier: "platinum" } })).where).toEqual(
            q.eq("channel", "platinum"),
        )
    })

    it("turns the chosen filters into equalities and memberships typed by their field", () => {
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { stage: "won" } })).where).toEqual(q.eq("stage", "won"))
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { stages: "new" } })).where).toEqual(
            q.in("stage", ["new"]),
        )
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { active: "true" } })).where).toEqual(
            q.eq("active", true),
        )
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { active: "false" } })).where).toEqual(
            q.eq("active", false),
        )
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { big: "1000" } })).where).toEqual(
            q.eq("amountVnd", 1000),
        )
    })

    it("reads the value as text when the field is not a declared one", () => {
        const shape: ListShape = { ...LEAD_SHAPE, filters: { tier: { field: "data.tier", op: "eq", of: ["gold"] } } }
        expect(listQueryOf(LEAD, shape, query({ filters: { tier: "gold" } })).where).toEqual(q.eq("data.tier", "gold"))
    })

    it("turns a chosen case into its comparison", () => {
        const where = (name: string) => listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { handled: name } })).where
        expect(where("open")).toEqual(q.isNull("ownerId"))
        expect(where("big")).toEqual(q.gte("amountVnd", 1000))
        expect(where("late")).toEqual(q.ltRef("endsAt", "startsAt"))
        expect(where("one")).toEqual(q.in("stage", ["new"]))
    })

    it("and-s the search with the filters", () => {
        const tree = listQueryOf(LEAD, LEAD_SHAPE, query({ q: "dinh", filters: { stage: "won", active: "true" } }))
        expect(tree.where).toEqual(q.and(q.search(["contactName"], "dinh"), q.eq("stage", "won"), q.eq("active", true)))
    })

    it("clamps the page size and carries the cursor", () => {
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ size: 0 })).page).toEqual({ size: 1 })
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ size: 500 })).page).toEqual({ size: 100 })
        expect(listQueryOf(LEAD, LEAD_SHAPE, query({ size: 30, cursor: "abc" })).page).toEqual({
            size: 30,
            after: "abc",
        })
    })

    it("builds trees the index check accepts", () => {
        expect(queryProblems(listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { stage: "won" } })), CATALOG)).toEqual([])
    })

    it("refuses what the shape does not declare", () => {
        expect(codeOf(() => listQueryOf(LEAD, LEAD_SHAPE, query({ sort: "nope" })))).toBe("LIST_SORT_UNKNOWN: nope")
        expect(codeOf(() => listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { nope: "x" } })))).toBe(
            "LIST_FILTER_UNKNOWN: nope",
        )
        expect(codeOf(() => listQueryOf(LEAD, PLAIN_SHAPE, query({ filters: { stage: "won" } })))).toBe(
            "LIST_FILTER_UNKNOWN: stage",
        )
        expect(codeOf(() => listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { stage: "bogus" } })))).toBe(
            "LIST_FILTER_VALUE_UNKNOWN: stage=bogus",
        )
        expect(codeOf(() => listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { handled: "bogus" } })))).toBe(
            "LIST_FILTER_VALUE_UNKNOWN: handled=bogus",
        )
        expect(codeOf(() => listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { active: "maybe" } })))).toBe(
            "LIST_FILTER_VALUE_UNKNOWN: active=maybe",
        )
        expect(codeOf(() => listQueryOf(LEAD, LEAD_SHAPE, query({ filters: { big: "oops" } })))).toBe(
            "LIST_FILTER_VALUE_UNKNOWN: amountVnd=oops",
        )
    })

    it("refuses a case that is not a comparison", () => {
        const shapeOf = (filterCase: FilterCase): ListShape => ({
            ...LEAD_SHAPE,
            filters: { odd: { cases: { bad: filterCase } } },
        })
        const run = (shape: ListShape) => codeOf(() => listQueryOf(LEAD, shape, query({ filters: { odd: "bad" } })))
        expect(run(shapeOf({ field: "stage", op: "in", ref: "channel" }))).toBe("LIST_FILTER_CASE_INVALID: odd=bad")
        expect(run(shapeOf({ field: "stage", op: "eq" }))).toBe("LIST_FILTER_CASE_INVALID: odd=bad")
        expect(run(shapeOf({ field: "stage", op: "lt", value: null }))).toBe("LIST_FILTER_CASE_INVALID: odd=bad")
    })
})

describe("countsOf", () => {
    it("groups by the field of the counted filter", () => {
        const tree = countsOf(LEAD, LEAD_SHAPE, "stage", BASE)
        expect(tree).toEqual({
            from: "sales.lead",
            groupBy: ["stage"],
            measures: { count: { kind: "count" } },
            limit: 1000,
        })
        expect(queryProblems(tree, CATALOG)).toEqual([])
    })

    it("keeps the search and the other filters but never the counted one", () => {
        const tree = countsOf(
            LEAD,
            LEAD_SHAPE,
            "stage",
            query({ q: "dinh", filters: { stage: "won", active: "true" } }),
        )
        expect(tree.where).toEqual(q.and(q.search(["contactName"], "dinh"), q.eq("active", true)))
    })

    it("counts the cases of a cases filter in one statement, each with its own where", () => {
        const tree = countsOf(
            LEAD,
            LEAD_SHAPE,
            "handled",
            query({ q: "dinh", filters: { handled: "open", active: "true" } }),
        )
        expect(tree).toEqual({
            from: "sales.lead",
            where: q.and(q.search(["contactName"], "dinh"), q.eq("active", true)),
            measures: {
                open: { kind: "count", where: q.isNull("ownerId") },
                big: { kind: "count", where: q.gte("amountVnd", 1000) },
                late: { kind: "count", where: q.ltRef("endsAt", "startsAt") },
                one: { kind: "count", where: q.in("stage", ["new"]) },
            },
            limit: 1,
        })
        expect(queryProblems(tree, CATALOG)).toEqual([])
    })

    it("has no where when nothing narrows the list", () => {
        expect(countsOf(LEAD, LEAD_SHAPE, "handled", BASE).where).toBeUndefined()
    })

    it("refuses an unknown filter", () => {
        expect(codeOf(() => countsOf(LEAD, LEAD_SHAPE, "nope", BASE))).toBe("LIST_FILTER_UNKNOWN: nope")
    })
})
