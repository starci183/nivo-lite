import { loadingSlot, mapSlot, slotOfRead, slotOfReads } from "./slot"
import type { SlotRead } from "./slot.types"

const FORBIDDEN = new Error("forbidden")
const isForbidden = (error: unknown): boolean => error === FORBIDDEN

const read = <T>(fields: Partial<SlotRead<T>>): SlotRead<T> => ({
    data: undefined,
    error: undefined,
    isLoading: false,
    ...fields,
})

describe("loadingSlot", () => {
    it("is the loading status", () => {
        expect(loadingSlot()).toEqual({ isLoading: true })
    })
})

describe("mapSlot", () => {
    it("maps the items of a ready slot and keeps its revalidation", () => {
        expect(mapSlot({ items: 2, isValidating: true }, (value) => value * 3)).toEqual({
            items: 6,
            isValidating: true,
        })
    })

    it("turns a mapped empty array into the empty status", () => {
        expect(mapSlot({ items: [1] }, () => [])).toEqual({ isEmpty: true })
    })

    it("carries every other status over unchanged", () => {
        expect(mapSlot({ isError: true }, () => 1)).toEqual({ isError: true })
    })
})

describe("slotOfRead", () => {
    it("is ready once data arrived", () => {
        expect(slotOfRead(read({ data: "x" }), isForbidden)).toEqual({ items: "x" })
    })

    it("is forbidden or an error when the read failed", () => {
        expect(slotOfRead(read({ error: FORBIDDEN }), isForbidden)).toEqual({ isForbidden: true })
        expect(slotOfRead(read({ error: new Error("boom") }), isForbidden)).toEqual({ isError: true })
    })

    it("is loading only while a read is in flight, else empty", () => {
        expect(slotOfRead(read({ isLoading: true }), isForbidden)).toEqual({ isLoading: true })
        expect(slotOfRead(read({}), isForbidden)).toEqual({ isEmpty: true })
    })
})

describe("slotOfReads", () => {
    it("is loading while any read has no first data", () => {
        expect(slotOfReads([read({ data: 1 }), read({ isLoading: true })], () => 1, isForbidden)).toEqual({
            isLoading: true,
        })
    })

    it("is the failure of the first read that failed without data", () => {
        expect(slotOfReads([read({ error: FORBIDDEN })], () => 1, isForbidden)).toEqual({ isForbidden: true })
    })

    it("is empty while a read has no data, or when the items are undefined", () => {
        expect(slotOfReads([read({})], () => 1, isForbidden)).toEqual({ isEmpty: true })
        expect(slotOfReads([read({ data: 1 })], () => undefined, isForbidden)).toEqual({ isEmpty: true })
    })

    it("draws the items together, validating when any read is", () => {
        expect(
            slotOfReads([read({ data: 1 }), read({ data: 2, isValidating: true })], () => "both", isForbidden),
        ).toEqual({ items: "both", isValidating: true })
    })
})
