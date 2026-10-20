import {
    clockOf,
    customerIdOf,
    guestIdOf,
    numberAt,
    roomLabelsOf,
    roomsOf,
    slotAt,
    slotsOf,
    slotTimesOf,
    textAt,
    nightlyOf,
} from "./gateway-reply.policy"

describe("hotel-reply.policy", () => {
    it("reads members", () => {
        expect(textAt({ a: "x", b: 3, c: true }, "a")).toBe("x")
        expect(textAt({ b: 3 }, "b")).toBe("3")
        expect(textAt({ c: true }, "c")).toBe("")
        expect(textAt(null, "a")).toBe("")
        expect(numberAt({ a: 2 }, "a")).toBe(2)
        expect(numberAt({ a: "2" }, "a")).toBeNull()
    })

    it("prints Vietnam clock times", () => {
        expect(clockOf("2026-10-24T08:00:00Z")).toBe("15:00")
        expect(clockOf("15:00")).toBe("15:00")
    })

    it("reads slots and picks the wished one or the next", () => {
        const slots = slotsOf({
            slots: [
                { slotId: "s1", startsAt: "2026-10-24T07:00:00Z" },
                { slotId: "s2", startsAt: "2026-10-24T08:30:00Z" },
                { startsAt: "x" },
                "junk",
            ],
        })
        expect(slots).toEqual([
            { slotId: "s1", time: "14:00" },
            { slotId: "s2", time: "15:30" },
        ])
        expect(slotsOf({ slots: "none" })).toEqual([])
        expect(slotAt(slots, "14:00")?.slotId).toBe("s1")
        expect(slotAt(slots, "15:00")?.slotId).toBe("s2")
        expect(slotAt(slots, "18:00")).toBeNull()
        expect(slotAt(slots, null)?.slotId).toBe("s1")
        expect(slotAt([], null)).toBeNull()
        expect(slotTimesOf(slots)).toBe("14:00, 15:30")
    })

    it("reads free rooms", () => {
        const rooms = roomsOf({
            roomTypes: [
                { code: "deluxe", name: "Deluxe", available: 2 },
                { code: "suite", available: 0 },
                { code: "twin" },
                { code: "", available: 3 },
                { code: "family", available: 1 },
            ],
        })
        expect(rooms).toEqual([
            { roomType: "deluxe", label: "Deluxe (2)" },
            { roomType: "family", label: "family (1)" },
        ])
        expect(roomLabelsOf(rooms)).toBe("Deluxe (2), family (1)")
    })

    it("reads guest ids, Zalo identities and customer ids", () => {
        expect(guestIdOf({ guestId: "g1" })).toBe("g1")
        expect(guestIdOf({ found: true, guest: { guestId: "g2" } })).toBe("g2")
        expect(guestIdOf({ guest: { guestId: "" } })).toBeNull()
        expect(guestIdOf({ guest: "x" })).toBeNull()
        expect(customerIdOf("123:archived")).toBe("123")
        expect(customerIdOf("123")).toBe("123")
        expect(nightlyOf({ nights: [{ rateVnd: 1950000 }, { rateVnd: 1650000 }] })).toBe(1950000)
        expect(nightlyOf({ nights: [] })).toBeNull()
    })
})
