import { Test } from "@nestjs/testing"
import { rowOf as effectsRowOf } from "@tests/fixtures/builders/booking-effects.builder"
import { builder } from "@starci/jest-preset"
import { DEFAULT_SETTINGS } from "../bookings.contracts"
import type { BookingEventKind } from "../bookings.contracts"
import {
    cancelFeeOf,
    feeOf,
    isLateCancel,
    namedEffects,
    noticeMark,
    noticeOf,
    remindersOf,
} from "./booking-effects.policy"
const SUBJECT = Symbol("booking-effects.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { isLateCancel, cancelFeeOf, noticeOf, noticeMark, remindersOf, feeOf, namedEffects },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./booking-effects.policy")>(SUBJECT)
}

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
        it("requires a cancellation and excludes the exact edge of the window", async () => {
            const subject = await build()

            expect(subject.isLateCancel(START, null, 24)).toBe(false)
            expect(subject.isLateCancel(START, START - 24 * HOUR, 24)).toBe(false)
            expect(subject.isLateCancel(START, START - 24 * HOUR - 1, 24)).toBe(false)
            expect(subject.isLateCancel(START, START - 24 * HOUR + 1, 24)).toBe(true)
            expect(subject.isLateCancel(START, START + 1, 24)).toBe(true)
        })
    })

    describe("cancelFeeOf", () => {
        it.each(["owner", "owner_cancelled"])("waives the fee for the owner's reason %s", async (cancel_reason) => {
            const subject = await build()

            expect(subject.cancelFeeOf(rowOf({ cancel_reason }), 24, 25)).toBe(0)
        })

        it("charges and rounds the customer's late cancellation with or without a reason", async () => {
            const subject = await build()

            expect(subject.cancelFeeOf(rowOf(), 24, 25)).toBe(50_000)
            expect(subject.cancelFeeOf(rowOf({ cancel_reason: null, price_vnd: 99_999 }), 24, 33)).toBe(33_000)
        })

        it.each([null, 0, -1])("charges nothing for an unusable price %p", async (price_vnd) => {
            const subject = await build()

            expect(subject.cancelFeeOf(rowOf({ price_vnd }), 24, 25)).toBe(0)
        })

        it.each([0, -10])("charges nothing for a nonpositive percentage %p", async (feePct) => {
            const subject = await build()

            expect(subject.cancelFeeOf(rowOf(), 24, feePct)).toBe(0)
        })

        it("charges nothing when the customer cancelled on time or did not cancel", async () => {
            const subject = await build()

            expect(subject.cancelFeeOf(rowOf({ cancelled_ms: START - 24 * HOUR }), 24, 25)).toBe(0)
            expect(subject.cancelFeeOf(rowOf({ cancelled_ms: null }), 24, 25)).toBe(0)
        })
    })
})

describe("booking-effects.policy", () => {
    describe("noticeOf", () => {
        it.each<BookingEventKind>(["created", "status", "moved"])(
            "gives cancellation priority over the event %s",
            async (kind) => {
                const subject = await build()

                expect(subject.noticeOf(kind, "cancelled")).toBe("cancelled")
            },
        )

        it("announces a move by event or status before a confirmation", async () => {
            const subject = await build()

            expect(subject.noticeOf("moved", "confirmed")).toBe("moved")
            expect(subject.noticeOf("status", "rescheduled")).toBe("moved")
            expect(subject.noticeOf("created", "confirmed")).toBe("confirmed")
        })

        it.each<BookingEventKind>(["created", "status", "moved"])(
            "gives a no-show priority over the event %s",
            async (kind) => {
                const subject = await build()

                expect(subject.noticeOf(kind, "no_show")).toBe("no_show")
            },
        )

        it.each(["requested", "done", "unknown"])("does not announce the status %s", async (status) => {
            const subject = await build()

            expect(subject.noticeOf("status", status)).toBeNull()
        })
    })
})

describe("booking-effects.policy", () => {
    describe("noticeMark", () => {
        it("keys moves on their count and other notices on their kind", async () => {
            const subject = await build()

            expect(subject.noticeMark("moved", 0)).toBe("notice:moved:0")
            expect(subject.noticeMark("moved", 3)).toBe("notice:moved:3")
            expect(subject.noticeMark("confirmed", 3)).toBe("notice:confirmed")
            expect(subject.noticeMark("cancelled", 3)).toBe("notice:cancelled")
            expect(subject.noticeMark("no_show", 3)).toBe("notice:no_show")
        })
    })

    describe("remindersOf", () => {
        it.each([
            { live: true, closed: false, expected: "planned" },
            { live: true, closed: true, expected: "planned" },
            { live: false, closed: true, expected: "stopped" },
            { live: false, closed: false, expected: "none" },
        ])("returns $expected for live=$live and closed=$closed", async ({ live, closed, expected }) => {
            const subject = await build()

            expect(subject.remindersOf(live, closed)).toBe(expected)
        })
    })
})

describe("booking-effects.policy", () => {
    describe("feeOf", () => {
        it("uses the settings' cancellation window and percentage for a cancelled booking", async () => {
            const subject = await build()

            const row = { ...rowOf(), status: "cancelled" }
            const settings = {
                ...DEFAULT_SETTINGS,
                cancelWindowHours: 2,
                lateCancelFeePct: 37,
                noShowFeeVnd: 75_000,
            }

            expect(subject.feeOf(row, settings)).toBe(74_000)
            expect(subject.feeOf({ ...row, cancelled_ms: START - 2 * HOUR }, settings)).toBe(0)
            expect(subject.feeOf(row, { ...settings, cancelWindowHours: 1 })).toBe(0)
            expect(subject.feeOf(row, { ...settings, lateCancelFeePct: 10 })).toBe(20_000)
            expect(subject.feeOf({ ...row, cancel_reason: "owner" }, settings)).toBe(0)
        })

        it.each([0, 65_000])(
            "uses the configured no-show fee %p regardless of cancellation facts",
            async (noShowFeeVnd) => {
                const subject = await build()

                const row = {
                    ...rowOf({ price_vnd: null, cancel_reason: "owner", cancelled_ms: null }),
                    status: "no_show",
                }

                expect(subject.feeOf(row, { ...DEFAULT_SETTINGS, noShowFeeVnd, lateCancelFeePct: 50 })).toBe(
                    noShowFeeVnd,
                )
            },
        )

        it.each(["requested", "confirmed", "rescheduled", "done", "unknown"])(
            "charges nothing for the status %s",
            async (status) => {
                const subject = await build()

                expect(
                    subject.feeOf(
                        { ...rowOf(), status },
                        { ...DEFAULT_SETTINGS, lateCancelFeePct: 50, noShowFeeVnd: 65_000 },
                    ),
                ).toBe(0)
            },
        )
    })
})

describe("booking-effects.policy", () => {
    describe("namedEffects", () => {
        const base = { ...effectsRowOf(), service_id: "s-1", resource_id: "r-1" }

        it("names the booking with the current names of its service and resource", async () => {
            const subject = await build()

            const row = subject.namedEffects(base, new Map([["s-1", "Cut"]]), new Map([["r-1", "Anna"]]))

            expect(row).toEqual(effectsRowOf({ service_name: "Cut", resource_name: "Anna" }))
            expect(row).not.toHaveProperty("service_id")
            expect(row).not.toHaveProperty("resource_id")
        })

        it("leaves the resource name empty when the resource is gone", async () => {
            const subject = await build()

            expect(subject.namedEffects(base, new Map([["s-1", "Cut"]]), new Map())).toMatchObject({
                resource_name: "",
            })
        })

        it("answers none when the service is gone", async () => {
            const subject = await build()

            expect(subject.namedEffects(base, new Map(), new Map([["r-1", "Anna"]]))).toBeNull()
        })
    })
})
