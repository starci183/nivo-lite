import type { WorkItem } from "@modules/domain/decisions"
import { contactOf, LIVE_BOOKING_STATUSES, reminderOriginOf, settlementOf } from "./booking-remind.policy"

describe("LIVE_BOOKING_STATUSES", () => {
    it("keeps reminders for requested, confirmed and rescheduled bookings", () => {
        expect(LIVE_BOOKING_STATUSES).toEqual(["requested", "confirmed", "rescheduled"])
    })
})

describe("settlementOf", () => {
    it.each<{ status: WorkItem["status"]; settlement: string }>([
        { status: "done", settlement: "sent" },
        { status: "waiting_decision", settlement: "waiting" },
        { status: "rejected", settlement: "skipped" },
        { status: "queued", settlement: "failed" },
        { status: "failed", settlement: "failed" },
    ])("settles $status as $settlement", ({ status, settlement }) => {
        expect(settlementOf(status)).toBe(settlement)
    })
})

describe("reminderOriginOf", () => {
    it("keeps simulated bookings simulated", () => {
        expect(reminderOriginOf("simulated")).toBe("simulated")
    })

    it.each(["live", "", "other"])("treats origin '%s' as live", (origin) => {
        expect(reminderOriginOf(origin)).toBe("live")
    })
})

describe("contactOf", () => {
    it("prefers the phone to the email and chat", () => {
        expect(contactOf("0901234567", "lan@example.com", "k\u00eanh chat")).toBe("0901234567")
    })

    it("uses the email when the phone is missing", () => {
        expect(contactOf(null, "lan@example.com", "k\u00eanh chat")).toBe("lan@example.com")
    })

    it("uses the chat when both phone and email are missing", () => {
        expect(contactOf(null, null, "k\u00eanh chat")).toBe("k\u00eanh chat")
    })

    it("keeps an empty phone instead of falling back to email", () => {
        expect(contactOf("", "lan@example.com", "k\u00eanh chat")).toBe("")
    })

    it("keeps an empty email instead of falling back to chat", () => {
        expect(contactOf(null, "", "k\u00eanh chat")).toBe("")
    })
})
