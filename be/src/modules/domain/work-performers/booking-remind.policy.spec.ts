import { Test } from "@nestjs/testing"
import type { WorkItem } from "@modules/domain/decisions"
import { LIVE_BOOKING_STATUSES, settlementOf, reminderOriginOf, contactOf } from "./booking-remind.policy"

const SUBJECT = Symbol("booking-remind.policy")
type Subject = {
    settlementOf: typeof settlementOf
    reminderOriginOf: typeof reminderOriginOf
    contactOf: typeof contactOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    settlementOf,
                    reminderOriginOf,
                    contactOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

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
    ])("settles $status as $settlement", async ({ status, settlement }) => {
        const subject = await buildSubject()
        expect(subject.settlementOf(status)).toBe(settlement)
    })
})

describe("reminderOriginOf", () => {
    it("keeps simulated bookings simulated", async () => {
        const subject = await buildSubject()
        expect(subject.reminderOriginOf("simulated")).toBe("simulated")
    })

    it.each(["live", "", "other"])("treats origin '%s' as live", async (origin) => {
        const subject = await buildSubject()
        expect(subject.reminderOriginOf(origin)).toBe("live")
    })
})

describe("contactOf", () => {
    it("prefers the phone to the email and chat", async () => {
        const subject = await buildSubject()
        expect(subject.contactOf("0901234567", "lan@example.com", "k\u00eanh chat")).toBe("0901234567")
    })

    it("uses the email when the phone is missing", async () => {
        const subject = await buildSubject()
        expect(subject.contactOf(null, "lan@example.com", "k\u00eanh chat")).toBe("lan@example.com")
    })

    it("uses the chat when both phone and email are missing", async () => {
        const subject = await buildSubject()
        expect(subject.contactOf(null, null, "k\u00eanh chat")).toBe("k\u00eanh chat")
    })

    it("keeps an empty phone instead of falling back to email", async () => {
        const subject = await buildSubject()
        expect(subject.contactOf("", "lan@example.com", "k\u00eanh chat")).toBe("")
    })

    it("keeps an empty email instead of falling back to chat", async () => {
        const subject = await buildSubject()
        expect(subject.contactOf(null, "", "k\u00eanh chat")).toBe("")
    })
})
