import { GROUP_GAP_MS, groupPositionsOf } from "./grouping"
import type { GroupItem } from "./grouping"

const MINUTE = 60_000
const T0 = Date.UTC(2026, 10, 9, 9, 0, 0)

const item = (sender: string | null, minutes: number, startsDay = false): GroupItem => ({
    sender,
    at: T0 + minutes * MINUTE,
    startsDay,
})

describe("groupPositionsOf", () => {
    it("is nothing for no message and single for a lone one", () => {
        expect(groupPositionsOf([])).toEqual([])
        expect(groupPositionsOf([item("user:a", 0)])).toEqual(["single"])
    })

    it("marks a run from one sender first, middle, last", () => {
        const positions = groupPositionsOf([item("user:a", 0), item("user:a", 1), item("user:a", 2), item("user:a", 3)])
        expect(positions).toEqual(["first", "middle", "middle", "last"])
    })

    it("ends a run when the sender changes", () => {
        const positions = groupPositionsOf([item("user:a", 0), item("user:a", 1), item("user:b", 2), item("user:a", 3)])
        expect(positions).toEqual(["first", "last", "single", "single"])
    })

    it("keeps a pause of exactly three minutes in the run and ends it after more", () => {
        expect(GROUP_GAP_MS).toBe(3 * MINUTE)
        expect(groupPositionsOf([item("user:a", 0), item("user:a", 3)])).toEqual(["first", "last"])
        expect(groupPositionsOf([item("user:a", 0), item("user:a", 3.01)])).toEqual(["single", "single"])
    })

    it("measures the pause from the message just before, so a long chat of short pauses is one run", () => {
        const positions = groupPositionsOf([item("user:a", 0), item("user:a", 2), item("user:a", 4), item("user:a", 6)])
        expect(positions).toEqual(["first", "middle", "middle", "last"])
    })

    it("ends a run at a day divider even when the pause is short", () => {
        const positions = groupPositionsOf([item("user:a", 0), item("user:a", 1, true), item("user:a", 2)])
        expect(positions).toEqual(["single", "first", "last"])
    })

    it("never joins a message with no sender (a card, a system line) to a run", () => {
        const positions = groupPositionsOf([item("user:a", 0), item(null, 1), item("user:a", 2), item(null, 2), item(null, 3)])
        expect(positions).toEqual(["single", "single", "single", "single", "single"])
    })

    it("does not join the same id of a person and of an agent", () => {
        expect(groupPositionsOf([item("user:1", 0), item("agent:1", 1)])).toEqual(["single", "single"])
    })

    it("does not join messages that arrive out of order", () => {
        expect(groupPositionsOf([item("user:a", 5), item("user:a", 4)])).toEqual(["single", "single"])
    })
})
