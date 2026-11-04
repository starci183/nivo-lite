import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import { recordsView } from "../rows/rows"
import { derivedSlot, parsedSlot, rowsSlot } from "./slots"

describe("parsedSlot", () => {
    it("carries a slot without items over unchanged", () => {
        const loading: DataSlot<unknown> = { isLoading: true }
        expect(parsedSlot(loading, recordsView)).toBe(loading)
    })

    it("parses the items of a ready slot and keeps its validating mark", () => {
        expect(parsedSlot({ items: [{ a: 1 }], isValidating: true }, recordsView)).toEqual({
            items: [{ a: 1 }],
            isValidating: true,
        })
        expect(parsedSlot({ items: [{}] }, recordsView)).toEqual({ items: [{}] })
    })

    it("turns items that do not fit into a failed read", () => {
        expect(parsedSlot({ items: ["x"], isValidating: true }, recordsView)).toEqual({ isError: true })
    })
})

describe("derivedSlot", () => {
    it("carries a slot without items over unchanged", () => {
        const forbidden: DataSlot<number> = { isForbidden: true }
        expect(derivedSlot(forbidden, (items) => items)).toBe(forbidden)
    })

    it("hands the picked value on with the validating mark", () => {
        expect(derivedSlot({ items: 2, isValidating: false }, (items) => items * 2)).toEqual({
            items: 4,
            isValidating: false,
        })
        expect(derivedSlot({ items: 2 }, (items) => items * 2)).toEqual({ items: 4 })
    })

    it("is empty when nothing can be picked", () => {
        expect(derivedSlot({ items: 2, isValidating: true }, () => null)).toEqual({ isEmpty: true, isValidating: true })
        expect(derivedSlot({ items: 2 }, () => null)).toEqual({ isEmpty: true })
    })
})

describe("rowsSlot", () => {
    it("keeps a view with rows and empties one without", () => {
        const full = { rows: [1] }
        expect(rowsSlot({ items: full })).toEqual({ items: full })
        expect(rowsSlot({ items: { rows: [] } })).toEqual({ isEmpty: true })
    })
})
