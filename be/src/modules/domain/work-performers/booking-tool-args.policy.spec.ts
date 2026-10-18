import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { BookingServiceCandidate } from "@modules/domain/agent-tools"
import {
    bookingDateIn,
    readBookingFindSlotsArgs,
    readBookingRequestArgs,
    readBookingCancelArgs,
    resolveBookingService,
    isPlausibleBookingPhone,
    normaliseBookingPhone,
} from "./booking-tool-args.policy"

const SUBJECT = Symbol("booking-tool-args.policy")
type Subject = {
    bookingDateIn: typeof bookingDateIn
    readBookingFindSlotsArgs: typeof readBookingFindSlotsArgs
    readBookingRequestArgs: typeof readBookingRequestArgs
    readBookingCancelArgs: typeof readBookingCancelArgs
    resolveBookingService: typeof resolveBookingService
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    bookingDateIn,
                    readBookingFindSlotsArgs,
                    readBookingRequestArgs,
                    readBookingCancelArgs,
                    resolveBookingService,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const serviceOf = builder<BookingServiceCandidate>({
    id: "service-1",
    name: "Cut",
    active: true,
})

describe("booking tool arguments", () => {
    it("reads a trimmed local date and rounds the party using public booking rules", async () => {
        const policy = await buildSubject()
        expect(policy.readBookingFindSlotsArgs({ service: " Cut ", date: " 2026-10-12 ", party_size: 2.6 })).toEqual({
            service: "Cut",
            date: "2026-10-12",
            party: 3,
        })
    })

    it("leaves absent and malformed dates to the shop timezone default", async () => {
        const policy = await buildSubject()
        for (const date of [undefined, 42, "12/10/2026", "2026-02-30", "2026-13-12", "2026-10-12extra"]) {
            expect(policy.readBookingFindSlotsArgs({ date }).date).toBeNull()
        }
        expect(policy.readBookingFindSlotsArgs({}).date).toBeNull()
        expect(policy.readBookingFindSlotsArgs({ date: "2028-02-29" }).date).toBe("2028-02-29")
    })

    it("bounds parties and avoids coercing non-numeric arguments", async () => {
        const policy = await buildSubject()
        for (const party_size of [undefined, "3", {}, NaN, Infinity, -Infinity, -1, 0]) {
            expect(policy.readBookingFindSlotsArgs({ party_size }).party).toBe(1)
            expect(policy.readBookingRequestArgs({ party_size }).party).toBe(1)
        }
        expect(policy.readBookingFindSlotsArgs({ party_size: 500 }).party).toBe(20)
    })

    it("reads the customer details and keeps an ISO slot for the idempotency key", async () => {
        const policy = await buildSubject()
        expect(
            policy.readBookingRequestArgs({
                service: " Cut ",
                slot: " 2026-10-12T09:00:00+07:00 ",
                contact_name: " Mai ",
                contact: " 0912 345 678 ",
                party_size: 2,
                note: " first visit ",
            }),
        ).toEqual({
            service: "Cut",
            start: "2026-10-12T09:00:00+07:00",
            name: "Mai",
            phone: "0912 345 678",
            party: 2,
            note: "first visit",
        })
        expect(policy.readBookingRequestArgs({ slot: "2026-10-12T02:00:00.000Z" }).start).toBe(
            "2026-10-12T02:00:00.000Z",
        )
    })

    it("turns bad slots into an invalid start instead of accepting local or rolled dates", async () => {
        const policy = await buildSubject()
        for (const slot of [
            undefined,
            42,
            "tomorrow",
            "2026-10-12",
            "2026-10-12T09:00:00",
            "2026-02-30T09:00:00Z",
            "2026-10-12T24:00:00Z",
            "2026-10-12T09:00:00Zextra",
        ]) {
            expect(policy.readBookingRequestArgs({ slot }).start).toBe("")
        }
    })
})

describe("booking tool arguments", () => {
    it("clips free text and answers empty strings for non-text fields", async () => {
        const policy = await buildSubject()
        const request = policy.readBookingRequestArgs({
            service: "s".repeat(200),
            contact_name: "n".repeat(200),
            contact: "9".repeat(80),
            note: "x".repeat(500),
        })
        expect(request.service).toHaveLength(160)
        expect(request.name).toHaveLength(120)
        expect(request.phone).toHaveLength(40)
        expect(request.note).toHaveLength(400)
        expect(policy.readBookingRequestArgs({ contact_name: {}, contact: 123, note: false })).toEqual({
            service: "",
            start: "",
            name: "",
            phone: "",
            party: 1,
            note: "",
        })
    })

    it("reads a cancellation contact and bounded reason without requiring a reason", async () => {
        const policy = await buildSubject()
        expect(policy.readBookingCancelArgs({ contact: " 0912 345 678 ", reason: " travel " })).toEqual({
            phone: "0912 345 678",
            reason: "travel",
        })
        expect(policy.readBookingCancelArgs({ reason: "r".repeat(500) }).reason).toHaveLength(400)
        expect(policy.readBookingCancelArgs({ contact: {}, reason: false })).toEqual({ phone: "", reason: "" })
    })

    it("normalises booking phone prefixes and validates the stored digit count", () => {
        for (const raw of ["0912 345 678", "+84 912 345 678", "912345678"]) {
            const phone = normaliseBookingPhone(raw)
            expect(phone).toBe("84912345678")
            expect(isPlausibleBookingPhone(phone)).toBe(true)
        }
        for (const raw of ["", "letters", "123", "9".repeat(16)]) {
            expect(isPlausibleBookingPhone(normaliseBookingPhone(raw))).toBe(false)
        }
    })

    it("uses the shop's calendar day across UTC midnight", async () => {
        const policy = await buildSubject()
        const instant = Date.UTC(2026, 9, 11, 18, 30)
        expect(policy.bookingDateIn(instant, "Asia/Ho_Chi_Minh")).toBe("2026-10-12")
        expect(policy.bookingDateIn(instant, "America/Los_Angeles")).toBe("2026-10-11")
    })

    it("leaves missing calendar parts empty when the formatter supplies none", async () => {
        const policy = await buildSubject()
        const instant = Date.UTC(2026, 9, 11, 18, 30)
        const formatParts = jest.spyOn(Intl.DateTimeFormat.prototype, "formatToParts").mockReturnValue([])
        try {
            expect(policy.bookingDateIn(instant, "Asia/Ho_Chi_Minh")).toBe("--")
            expect(formatParts).toHaveBeenCalledWith(new Date(instant))
        } finally {
            formatParts.mockRestore()
        }
    })

    it("prefers an exact folded name even when an earlier active name contains it", async () => {
        const policy = await buildSubject()
        const containing = serviceOf({ id: "long", name: "Luxury Cut" })
        const exact = serviceOf({ id: "exact", name: "CUT" })
        expect(policy.resolveBookingService([containing, exact], " cut ")).toBe(exact)
        expect(policy.resolveBookingService([containing, exact], "luxury")).toBe(containing)
    })

    it("matches accents and the Vietnamese crossed d without changing source spelling", async () => {
        const policy = await buildSubject()
        const service = serviceOf({ name: "\u0110\u1eb7t l\u1ecbch" })
        expect(policy.resolveBookingService([service], "DAT LICH")).toBe(service)
        expect(policy.resolveBookingService([serviceOf({ name: "Caf\u00e9" })], "cafe")?.name).toBe("Caf\u00e9")
    })
})

describe("booking tool arguments", () => {
    it("uses only active services and requires a selection when several are active", async () => {
        const policy = await buildSubject()
        const active = serviceOf()
        const inactive = serviceOf({ id: "old", name: "Old", active: false })
        expect(policy.resolveBookingService([inactive, active], "")).toBe(active)
        expect(policy.resolveBookingService([inactive, active], "old")).toBeUndefined()
        expect(policy.resolveBookingService([active, serviceOf({ id: "other" })], "")).toBeUndefined()
        expect(policy.resolveBookingService([], "")).toBeUndefined()
        expect(policy.resolveBookingService([active], "unknown")).toBeUndefined()
    })
})

describe("booking instant boundaries", () => {
    it.each([
        ["2026-10-12T23:59:59.123+23:59", true],
        ["2026-10-12T07:00Z", true],
        ["2026-10-12T24:00Z", false],
        ["2026-10-12T07:60Z", false],
        ["2026-10-12T07:00+24:00", false],
        ["2026-02-30T07:00Z", false],
        ["2026-10-12T07:00", false],
    ])("validates %s before booking placement", async (slot, valid) => {
        const policy = await buildSubject()
        expect(policy.readBookingRequestArgs({ slot }).start).toBe(valid ? slot : "")
    })
})
