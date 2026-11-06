import type { FilterFields, SearchFields } from "@starci/grammar/common"
import { paneHeadersOf } from "./pane-headers"

const FILTER: FilterFields = {
    label: "Status",
    items: [{ id: "all", label: "All" }],
    selectedKey: "all",
    onSelect: () => undefined,
}
const SEARCH: SearchFields = { label: "Search", value: "", onChange: () => undefined }

describe("paneHeadersOf", () => {
    it("puts the filter tabs and the search in one toolbar", () => {
        expect(paneHeadersOf(FILTER, SEARCH)).toEqual([{ kind: "toolbar", filter: FILTER, search: SEARCH }])
    })

    it("keeps the one zone a card has", () => {
        expect(paneHeadersOf(FILTER, null)).toEqual([{ kind: "filter", ...FILTER }])
        expect(paneHeadersOf(null, SEARCH)).toEqual([{ kind: "search", ...SEARCH }])
    })

    it("has no header when the card has neither", () => {
        expect(paneHeadersOf(null, null)).toEqual([])
    })
})
