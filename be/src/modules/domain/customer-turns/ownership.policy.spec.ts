import type { StayStage } from "./gateway-turns.contracts"
import { guestContextOf, ownerFor, stageOfStay } from "./ownership.policy"

const at = (iso: string): Date => new Date(iso)

describe("ownership.policy", () => {
    it("reads the stage of a stay", () => {
        expect(stageOfStay(null)).toEqual({ kind: "none" })
        expect(stageOfStay({ status: "checked_in" })).toEqual({ kind: "checked_in" })
        expect(stageOfStay({ status: "checked_out", checkedOutAt: "2026-10-20T03:00:00Z" })).toEqual({
            kind: "checked_out",
            at: "2026-10-20T03:00:00Z",
        })
        expect(stageOfStay({ status: "checked_out", checkOut: "2026-10-20" })).toEqual({
            kind: "checked_out",
            at: "2026-10-20",
        })
        expect(stageOfStay({ status: "reserved" })).toEqual({ kind: "none" })
        expect(stageOfStay({ status: "reserved", checkIn: "2026-10-24" })).toEqual({
            kind: "booked",
            confirmed: true,
            checkIn: "2026-10-24",
        })
        expect(stageOfStay({ checkIn: "2026-10-24", status: "held" })).toMatchObject({ confirmed: false })
    })

    it("builds the guest context", () => {
        expect(
            guestContextOf(
                { found: true, guest: { guestId: "g1", name: "Lan", tier: "vip" } },
                { found: true, stay: { stayId: "s1", roomNumber: "302", status: "checked_in" } },
            ),
        ).toEqual({ guestId: "g1", name: "Lan", tier: "vip", stayId: "s1", room: "302", stage: { kind: "checked_in" } })
        expect(guestContextOf({ guest: null }, null)).toEqual({
            guestId: null,
            name: "",
            tier: "",
            stayId: null,
            room: "",
            stage: { kind: "none" },
        })
        expect(guestContextOf(null, { stay: "x" }).stayId).toBeNull()
        expect(guestContextOf({ found: false }, { stay: { guestName: "Lan" } }).name).toBe("Lan")
    })

    it("hands the guest to care from 00:00 +07 of the arrival day of a confirmed booking", () => {
        const booked: StayStage = { kind: "booked", confirmed: true, checkIn: "2026-10-24" }
        expect(ownerFor(booked, at("2026-10-23T16:59:00Z"))).toEqual({ role: "sales", reason: "pre_arrival" })
        expect(ownerFor(booked, at("2026-10-23T17:00:00Z"))).toEqual({ role: "care", reason: "arrival_day" })
        expect(ownerFor({ ...booked, confirmed: false }, at("2026-10-24T05:00:00Z")).role).toBe("sales")
        expect(ownerFor({ ...booked, checkIn: "soon" }, at("2026-10-24T05:00:00Z")).role).toBe("sales")
        expect(ownerFor({ kind: "none" }, at("2026-10-24T05:00:00Z")).role).toBe("sales")
    })

    it("keeps care while checked in and for 24 hours after check-out", () => {
        const now = at("2026-10-26T10:00:00Z")
        expect(ownerFor({ kind: "checked_in" }, now)).toEqual({ role: "care", reason: "checked_in" })
        expect(ownerFor({ kind: "checked_out", at: "2026-10-26T03:00:00Z" }, now).role).toBe("care")
        expect(ownerFor({ kind: "checked_out", at: "2026-10-25T09:00:00Z" }, now)).toEqual({
            role: "sales",
            reason: "checked_out_24h",
        })
        expect(ownerFor({ kind: "checked_out", at: "" }, now).role).toBe("sales")
    })
})
