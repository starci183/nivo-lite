import type { ReadPage } from "@nivo-lite/agent-sdk/block"
import { keepRaw, relabeller } from "./value-labels"
import { chosenRow, moreStateOf, RECORD_ROWS_PLACEHOLDER, recordsView, rowsOf, selectionOf } from "./rows"

const PATHS = { idPath: "id", titlePath: "title", descriptionPath: "note", badgePath: "state" }

describe("rowsOf", () => {
    it("draws one row per record read through the paths", () => {
        const records = [
            { id: "a", title: "First", note: "n1", state: "open" },
            { id: 2, title: "Second" },
        ]
        expect(rowsOf(records, PATHS, keepRaw)).toEqual([
            { id: "a", title: "First", description: "n1", badge: "open", meta: "", chips: [] },
            { id: "2", title: "Second", description: "", badge: "", meta: "", chips: [] },
        ])
    })

    it("draws no description or badge when their paths are absent", () => {
        expect(rowsOf([{ id: "a", title: "T", note: "n" }], { idPath: "id", titlePath: "title" }, keepRaw)).toEqual([
            { id: "a", title: "T", description: "", badge: "", meta: "", chips: [] },
        ])
    })

    it("draws the short fact its path names", () => {
        const paths = { idPath: "id", titlePath: "title", metaPath: "when" }
        expect(rowsOf([{ id: "a", title: "T", when: "2 min" }], paths, keepRaw)?.map((row) => row.meta)).toEqual([
            "2 min",
        ])
    })

    it("draws the further chips their paths name and leaves out the empty ones", () => {
        const paths = { idPath: "id", titlePath: "title", chipPaths: ["channel", "owner"] }
        expect(rowsOf([{ id: "a", title: "T", channel: "Zalo" }], paths, keepRaw)?.map((row) => row.chips)).toEqual([
            ["Zalo"],
        ])
    })

    it("skips a record without a text id", () => {
        expect(rowsOf([{ title: "No id" }, { id: "b", title: "B" }], PATHS, keepRaw)).toEqual([
            { id: "b", title: "B", description: "", badge: "", meta: "", chips: [] },
        ])
    })

    it("draws the badge in the words the labels give its value, and a value with none as it is", () => {
        const relabel = relabeller({ state: { open: { key: "Dang mo" } } }, (text) =>
            "key" in text ? text.key : text.en,
        )
        const records = [
            { id: "a", title: "First", state: "open" },
            { id: "b", title: "Second", state: "closed" },
        ]
        expect(rowsOf(records, PATHS, relabel)?.map((row) => row.badge)).toEqual(["Dang mo", "closed"])
    })

    it("is null when no row can be drawn", () => {
        expect(rowsOf([], PATHS, keepRaw)).toBeNull()
        expect(rowsOf([{ title: "No id" }], PATHS, keepRaw)).toBeNull()
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
        expect(
            RECORD_ROWS_PLACEHOLDER.every((row) => row.badge === "" && row.meta === "" && row.chips.length === 0),
        ).toBe(true)
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
