import { builder } from "@starci/jest-preset"
import type { BookingEventKind } from "../bookings.contracts"
import { DEFAULT_SETTINGS } from "../persistence/booking.rows"
import { cancelFeeOf, feeOf, isLateCancel, noticeMark, noticeOf, remindersOf } from "./booking-effects.policy"

const HOUR = 3_600_000
const START = Date.UTC(2026, 9, 15, 2)
const rowOf = builder<Parameters<typeof cancelFeeOf>[0]>({
    price_vnd: 200_000,
    cancel_reason: "customer",
    start_ms: START,
    cancelled_ms: START - HOUR,
})

describe("booking-effects.policy", () => {
    describe("isLateCancel", () => {
        it("requires a cancellation and excludes the exact edge of the window", () => {
            expect(isLateCancel(START, null, 24)).toBe(false)
            expect(isLateCancel(START, START - 24 * HOUR, 24)).toBe(false)
            expect(isLateCancel(START, START - 24 * HOUR - 1, 24)).toBe(false)
            expect(isLateCancel(START, START - 24 * HOUR + 1, 24)).toBe(true)
            expect(isLateCancel(START, START + 1, 24)).toBe(true)
        })
    })

    describe("cancelFeeOf", () => {
        it.each(["owner", "owner_cancelled"])("waives the fee for the owner's reason %s", (cancel_reason) => {
            expect(cancelFeeOf(rowOf({ cancel_reason }), 24, 25)).toBe(0)
        })

        it("charges and rounds the customer's late cancellation with or without a reason", () => {
            expect(cancelFeeOf(rowOf(), 24, 25)).toBe(50_000)
            expect(cancelFeeOf(rowOf({ cancel_reason: null, price_vnd: 99_999 }), 24, 33)).toBe(33_000)
        })

        it.each([null, 0, -1])("charges nothing for an unusable price %p", (price_vnd) => {
            expect(cancelFeeOf(rowOf({ price_vnd }), 24, 25)).toBe(0)
        })

        it.each([0, -10])("charges nothing for a nonpositive percentage %p", (feePct) => {
            expect(cancelFeeOf(rowOf(), 24, feePct)).toBe(0)
        })

        it("charges nothing when the customer cancelled on time or did not cancel", () => {
            expect(cancelFeeOf(rowOf({ cancelled_ms: START - 24 * HOUR }), 24, 25)).toBe(0)
            expect(cancelFeeOf(rowOf({ cancelled_ms: null }), 24, 25)).toBe(0)
        })
    })

    describe("noticeOf", () => {
        it.each<BookingEventKind>(["created", "status", "moved"])(
            "gives cancellation priority over the event %s",
            (kind) => {
                expect(noticeOf(kind, "cancelled")).toBe("cancelled")
            },
        )

        it("announces a move by event or status before a confirmation", () => {
            expect(noticeOf("moved", "confirmed")).toBe("moved")
            expect(noticeOf("status", "rescheduled")).toBe("moved")
            expect(noticeOf("created", "confirmed")).toBe("confirmed")
        })

        it.each(["requested", "done", "no_show", "unknown"])("does not announce the status %s", (status) => {
            expect(noticeOf("status", status)).toBeNull()
        })
    })

    describe("noticeMark", () => {
        it("keys moves on their count and other notices on their kind", () => {
            expect(noticeMark("moved", 0)).toBe("notice:moved:0")
            expect(noticeMark("moved", 3)).toBe("notice:moved:3")
            expect(noticeMark("confirmed", 3)).toBe("notice:confirmed")
            expect(noticeMark("cancelled", 3)).toBe("notice:cancelled")
        })
    })

    describe("remindersOf", () => {
        it.each([
            { live: true, closed: false, expected: "planned" },
            { live: true, closed: true, expected: "planned" },
            { live: false, closed: true, expected: "stopped" },
            { live: false, closed: false, expected: "none" },
        ])("returns $expected for live=$live and closed=$closed", ({ live, closed, expected }) => {
            expect(remindersOf(live, closed)).toBe(expected)
        })
    })

    describe("feeOf", () => {
        it("uses the settings' cancellation window and percentage for a cancelled booking", () => {
            const row = { ...rowOf(), status: "cancelled" }
            const settings = {
                ...DEFAULT_SETTINGS,
                cancelWindowHours: 2,
                lateCancelFeePct: 37,
                noShowFeeVnd: 75_000,
            }

            expect(feeOf(row, settings)).toBe(74_000)
            expect(feeOf({ ...row, cancelled_ms: START - 2 * HOUR }, settings)).toBe(0)
            expect(feeOf(row, { ...settings, cancelWindowHours: 1 })).toBe(0)
            expect(feeOf(row, { ...settings, lateCancelFeePct: 10 })).toBe(20_000)
            expect(feeOf({ ...row, cancel_reason: "owner" }, settings)).toBe(0)
        })

        it.each([0, 65_000])("uses the configured no-show fee %p regardless of cancellation facts", (noShowFeeVnd) => {
            const row = { ...rowOf({ price_vnd: null, cancel_reason: "owner", cancelled_ms: null }), status: "no_show" }

            expect(feeOf(row, { ...DEFAULT_SETTINGS, noShowFeeVnd, lateCancelFeePct: 50 })).toBe(noShowFeeVnd)
        })

        it.each(["requested", "confirmed", "rescheduled", "done", "unknown"])(
            "charges nothing for the status %s",
            (status) => {
                expect(
                    feeOf({ ...rowOf(), status }, { ...DEFAULT_SETTINGS, lateCancelFeePct: 50, noShowFeeVnd: 65_000 }),
                ).toBe(0)
            },
        )
    })
})
