import { EMPTY_TAB_COUNTS } from "./filter-tabs"
import { footersOf, tabCountsOf } from "./list-card"

describe("tabCountsOf", () => {
    it("takes the counts of a read that answered, zero for each tab of a read that settled with nothing, and none otherwise", () => {
        const counts = { counts: { open: 2 }, total: 2 }
        expect(tabCountsOf({ items: counts })).toBe(counts)
        expect(tabCountsOf({ isEmpty: true })).toBe(EMPTY_TAB_COUNTS)
        expect(tabCountsOf({ isLoading: true })).toBeNull()
        expect(tabCountsOf({ isError: true })).toBeNull()
        expect(tabCountsOf({ isForbidden: true })).toBeNull()
    })
})

describe("footersOf", () => {
    const words = { loadMore: "Load more", retry: "Try again" }
    it("offers the next page, the retry after a failure, and nothing when there is no further page", () => {
        const press = (): void => undefined
        expect(footersOf("idle", words, press)).toEqual([{ kind: "more", label: "Load more", press }])
        expect(footersOf("loading", words, press)).toEqual([{ kind: "more", label: "Load more", press }])
        expect(footersOf("failed", words, press)).toEqual([{ kind: "more", label: "Try again", press }])
        expect(footersOf("none", words, press)).toEqual([])
    })
})
