import type { DataSlot } from "@nivo-lite/agent-sdk/client"
import { combinedSlots } from "./combine"

const rows = (...items: ReadonlyArray<string>): DataSlot<ReadonlyArray<string>> => ({ items })

describe("combinedSlots", () => {
    it("joins the rows of every read that has some, in the order of the reads", () => {
        expect(combinedSlots([rows("a"), { isEmpty: true }, rows("b", "c")])).toEqual({ items: ["a", "b", "c"] })
    })

    it("keeps the rows that came when another read is still loading or failed", () => {
        expect(combinedSlots([rows("a"), { isLoading: true }, { isError: true }])).toEqual({ items: ["a"] })
    })

    it("is loading while a read without rows loads, before it is a failure", () => {
        expect(combinedSlots([{ isError: true }, { isLoading: true }])).toEqual({ isLoading: true })
    })

    it("is a failure when a read failed and none has rows", () => {
        expect(combinedSlots([{ isEmpty: true }, { isError: true }])).toEqual({ isError: true })
    })

    it("is empty when the reads settled with nothing, an empty list among them", () => {
        expect(combinedSlots([{ isEmpty: true }, rows()])).toEqual({ isEmpty: true })
    })

    it("is forbidden only when no read may be seen", () => {
        expect(combinedSlots([{ isForbidden: true }, { isForbidden: true }])).toEqual({ isForbidden: true })
        expect(combinedSlots([{ isForbidden: true }, { isEmpty: true }])).toEqual({ isEmpty: true })
    })
})
