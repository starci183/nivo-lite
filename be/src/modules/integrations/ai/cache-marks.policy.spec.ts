import { CACHE_MARKS_ON_THE_WIRE, markedContentOf } from "./cache-marks.policy"

describe("markedContentOf", () => {
    it("puts nothing on the wire with the router installed today (0.5.0)", () => {
        expect(CACHE_MARKS_ON_THE_WIRE).toBe(false)
        expect(markedContentOf("stable", true)).toBe("stable")
    })

    it("gives a marked message one text part with an ephemeral breakpoint once marks go on the wire", () => {
        expect(markedContentOf("stable", true, true)).toEqual([
            { type: "text", text: "stable", cache_control: { type: "ephemeral" } },
        ])
        expect(markedContentOf("volatile", false, true)).toBe("volatile")
    })
})
