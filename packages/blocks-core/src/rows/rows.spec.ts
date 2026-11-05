import type { ReadPage } from "@nivo-lite/agent-sdk/block"
import { chosenRow, moreStateOf, RECORD_ROWS_PLACEHOLDER, recordsView, rowsOf, selectionOf } from "./rows"

const PATHS = { idPath: "id", titlePath: "title", descriptionPath: "note", badgePath: "state" }

describe("rowsOf", () => {
    it("draws one row per record read through the paths", () => {
        const records = [
            { id: "a", title: "First", note: "n1", state: "open" },
            { id: 2, title: "Second" },
        ]
        expect(rowsOf(records, PATHS)).toEqual([
            { id: "a", title: "First", description: "n1", badge: "open" },
            { id: "2", title: "Second", description: "", badge: "" },
        ])
    })

    it("draws no description or badge when their paths are absent", () => {
        expect(rowsOf([{ id: "a", title: "T", note: "n" }], { idPath: "id", titlePath: "title" })).toEqual([
            { id: "a", title: "T", description: "", badge: "" },
        ])
    })

    it("skips a record without a text id", () => {
        expect(rowsOf([{ title: "No id" }, { id: "b", title: "B" }], PATHS)).toEqual([
            { id: "b", title: "B", description: "", badge: "" },
        ])
    })

    it("is null when no row can be drawn", () => {
        expect(rowsOf([], PATHS)).toBeNull()
        expect(rowsOf([{ title: "No id" }], PATHS)).toBeNull()
    })
})

describe("recordsView", () => {
    it("accepts a list of records of any fields", () => {
        expect(recordsView.safeParse([{ id: "a" }, {}]).success).toBe(true)
    })

    it("refuses what is not a list of records, and a list past its bound", () => {
        expect(recordsView.safeParse({ id: "a" }).success).toBe(false)
        expect(recordsView.safeParse(["a"]).success).toBe(false)
        expect(recordsView.safeParse(Array.from({ length: 501 }, () => ({}))).success).toBe(false)
    })
})

describe("RECORD_ROWS_PLACEHOLDER", () => {
    it("holds three blank rows with distinct ids and no badge", () => {
        expect(RECORD_ROWS_PLACEHOLDER.map((row) => row.id)).toEqual([
            "placeholder-0",
            "placeholder-1",
            "placeholder-2",
        ])
        expect(RECORD_ROWS_PLACEHOLDER.every((row) => row.badge === "")).toBe(true)
    })
})

describe("selectionOf and chosenRow", () => {
    it("marks the row the param names, or none", () => {
        expect(selectionOf("c2")).toEqual(["c2"])
        expect(selectionOf(null)).toEqual([])
    })

    it("chooses the first id a change names and nothing for an empty change", () => {
        expect(chosenRow(["c3", "c4"])).toBe("c3")
        expect(chosenRow([])).toBeNull()
    })
})

describe("moreStateOf", () => {
    const page = (change: Partial<ReadPage>): ReadPage => ({
        hasMore: false,
        isLoadingMore: false,
        failure: false,
        loadMore: () => undefined,
        ...change,
    })

    it("has no control for a list that is not paged or has no more rows", () => {
        expect(moreStateOf(null)).toBe("none")
        expect(moreStateOf(page({}))).toBe("none")
    })

    it("offers the next page when there is one", () => {
        expect(moreStateOf(page({ hasMore: true }))).toBe("idle")
    })

    it("shows the load in flight, which wins over a stale failure", () => {
        expect(moreStateOf(page({ hasMore: true, isLoadingMore: true, failure: true }))).toBe("loading")
    })

    it("offers to try again after a failed load", () => {
        expect(moreStateOf(page({ hasMore: true, failure: true }))).toBe("failed")
    })
})
