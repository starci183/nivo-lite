import { settledHostRead } from "../../tests/fixtures/fakes"
import { foldRead } from "./host-slot"

describe("foldRead", () => {
    it("maps the transport statuses to slots", () => {
        expect(foldRead(settledHostRead("loading"), undefined)).toEqual({ slot: { isLoading: true }, isDefect: false })
        expect(foldRead(settledHostRead("forbidden"), undefined)).toEqual({
            slot: { isForbidden: true },
            isDefect: false,
        })
        expect(foldRead(settledHostRead("error"), undefined)).toEqual({ slot: { isError: true }, isDefect: false })
    })

    it("draws the value at the bound path, empty for null and empty lists", () => {
        const data = { rows: [1], none: [], nothing: null }
        expect(foldRead(settledHostRead("ready", data), "rows")).toEqual({
            slot: { items: [1], isValidating: false },
            isDefect: false,
        })
        expect(foldRead(settledHostRead("ready", data), "none").slot).toEqual({ isEmpty: true, isValidating: false })
        expect(foldRead(settledHostRead("ready", data), "nothing").slot).toEqual({ isEmpty: true, isValidating: false })
    })

    it("turns a path missing in ready data into an error slot and a defect", () => {
        expect(foldRead(settledHostRead("ready", { a: 1 }), "gone")).toEqual({
            slot: { isError: true },
            isDefect: true,
        })
    })
})
