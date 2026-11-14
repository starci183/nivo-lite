import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { freeSlotsOf as freeSlotsOfSubject, isoInZone as isoInZoneSubject, mergedSpans as mergedSpansSubject, offsetMsOf as offsetMsOfSubject, zonedInstantMs as zonedInstantMsSubject } from "./calendar-slots.policy"
import type { Span } from "./calendar-slots.policy"


const SUBJECT = Symbol("calendar-slots.policy")

const build = async (): Promise<{ freeSlotsOf: typeof freeSlotsOfSubject; isoInZone: typeof isoInZoneSubject; mergedSpans: typeof mergedSpansSubject; offsetMsOf: typeof offsetMsOfSubject; zonedInstantMs: typeof zonedInstantMsSubject }> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: mock<{ freeSlotsOf: typeof freeSlotsOfSubject; isoInZone: typeof isoInZoneSubject; mergedSpans: typeof mergedSpansSubject; offsetMsOf: typeof offsetMsOfSubject; zonedInstantMs: typeof zonedInstantMsSubject }>({ freeSlotsOf: freeSlotsOfSubject, isoInZone: isoInZoneSubject, mergedSpans: mergedSpansSubject, offsetMsOf: offsetMsOfSubject, zonedInstantMs: zonedInstantMsSubject }) }],
    }).compile()
    return moduleRef.get<{ freeSlotsOf: typeof freeSlotsOfSubject; isoInZone: typeof isoInZoneSubject; mergedSpans: typeof mergedSpansSubject; offsetMsOf: typeof offsetMsOfSubject; zonedInstantMs: typeof zonedInstantMsSubject }>(SUBJECT)
}

const MIN = 60_000
const at = (iso: string): number => Date.parse(iso)
const span = (from: string, to: string): Span => ({ start: at(from), end: at(to) })
const isoOf = (slots: ReadonlyArray<Span>): ReadonlyArray<string> => slots.map((slot) => `${new Date(slot.start).toISOString()}..${new Date(slot.end).toISOString()}`)

describe("mergedSpans", () => {
    let mergedSpans: typeof mergedSpansSubject

    beforeAll(async () => {
        ;({ mergedSpans } = await build())
    })

    it("sorts, merges overlapping and touching ranges and drops empty or inverted ones", () => {
        const merged = mergedSpans([
            span("2026-01-06T05:00:00Z", "2026-01-06T06:00:00Z"),
            span("2026-01-06T03:00:00Z", "2026-01-06T04:00:00Z"),
            span("2026-01-06T04:00:00Z", "2026-01-06T04:30:00Z"),
            span("2026-01-06T05:30:00Z", "2026-01-06T05:45:00Z"),
            span("2026-01-06T08:00:00Z", "2026-01-06T08:00:00Z"),
            span("2026-01-06T09:00:00Z", "2026-01-06T08:00:00Z"),
        ])
        expect(merged).toEqual([span("2026-01-06T03:00:00Z", "2026-01-06T04:30:00Z"), span("2026-01-06T05:00:00Z", "2026-01-06T06:00:00Z")])
    })
})

describe("freeSlotsOf (whole window)", () => {
    let freeSlotsOf: typeof freeSlotsOfSubject

    beforeAll(async () => {
        ;({ freeSlotsOf } = await build())
    })

    const window = span("2026-01-06T02:00:00Z", "2026-01-06T05:00:00Z")

    it("an empty calendar gives a slot every step from the window start while a whole slot fits", () => {
        const { slots, truncated } = freeSlotsOf({ window, busy: [], durationMs: 60 * MIN, stepMs: 60 * MIN, hours: null, limit: 50 })
        expect(isoOf(slots)).toEqual([
            "2026-01-06T02:00:00.000Z..2026-01-06T03:00:00.000Z",
            "2026-01-06T03:00:00.000Z..2026-01-06T04:00:00.000Z",
            "2026-01-06T04:00:00.000Z..2026-01-06T05:00:00.000Z",
        ])
        expect(truncated).toBe(false)
    })

    it("a busy range cuts the window; the free stretch after it starts at its end (exclusive) and a short remainder gives no slot", () => {
        const busy = [span("2026-01-06T02:20:00Z", "2026-01-06T03:10:00Z"), span("2026-01-06T04:30:00Z", "2026-01-06T04:40:00Z")]
        const { slots } = freeSlotsOf({ window, busy, durationMs: 30 * MIN, stepMs: 30 * MIN, hours: null, limit: 50 })
        // 02:00-02:20 is too short; 03:10-04:30 fits two; 04:40-05:00 is too short.
        expect(isoOf(slots)).toEqual([
            "2026-01-06T03:10:00.000Z..2026-01-06T03:40:00.000Z",
            "2026-01-06T03:40:00.000Z..2026-01-06T04:10:00.000Z",
        ])
    })

    it("busy time outside the window and an all-busy window change nothing / give no slot", () => {
        const outside = freeSlotsOf({
            window,
            busy: [span("2026-01-05T00:00:00Z", "2026-01-06T01:59:00Z"), span("2026-01-06T05:00:00Z", "2026-01-07T00:00:00Z")],
            durationMs: 180 * MIN,
            stepMs: 180 * MIN,
            hours: null,
            limit: 5,
        })
        expect(isoOf(outside.slots)).toEqual(["2026-01-06T02:00:00.000Z..2026-01-06T05:00:00.000Z"])
        const full = freeSlotsOf({ window, busy: [span("2026-01-06T00:00:00Z", "2026-01-06T09:00:00Z")], durationMs: 30 * MIN, stepMs: 30 * MIN, hours: null, limit: 5 })
        expect(full.slots).toEqual([])
    })

    it("a step shorter than the slot overlaps slots; the limit cuts the answer and says it was cut", () => {
        const { slots, truncated } = freeSlotsOf({ window, busy: [], durationMs: 60 * MIN, stepMs: 30 * MIN, hours: null, limit: 3 })
        expect(isoOf(slots)).toEqual([
            "2026-01-06T02:00:00.000Z..2026-01-06T03:00:00.000Z",
            "2026-01-06T02:30:00.000Z..2026-01-06T03:30:00.000Z",
            "2026-01-06T03:00:00.000Z..2026-01-06T04:00:00.000Z",
        ])
        expect(truncated).toBe(true)
    })

    it("a window exactly full does not report truncation", () => {
        const { slots, truncated } = freeSlotsOf({ window, busy: [], durationMs: 60 * MIN, stepMs: 60 * MIN, hours: null, limit: 3 })
        expect(slots).toHaveLength(3)
        expect(truncated).toBe(false)
    })
})

describe("freeSlotsOf (daily hours)", () => {
    let freeSlotsOf: typeof freeSlotsOfSubject

    beforeAll(async () => {
        ;({ freeSlotsOf } = await build())
    })

    it("applies each day's opening hours in the zone, cut to the window, minus busy time", () => {
        // Asia/Ho_Chi_Minh is UTC+7 without daylight saving: 09:00-11:00 local = 02:00-04:00Z.
        const { slots } = freeSlotsOf({
            window: span("2026-01-06T00:00:00Z", "2026-01-08T00:00:00Z"),
            busy: [span("2026-01-06T02:30:00Z", "2026-01-06T03:00:00Z")],
            durationMs: 60 * MIN,
            stepMs: 60 * MIN,
            hours: { fromMinutes: 9 * 60, toMinutes: 11 * 60, timeZone: "Asia/Ho_Chi_Minh" },
            limit: 20,
        })
        expect(isoOf(slots)).toEqual([
            "2026-01-06T03:00:00.000Z..2026-01-06T04:00:00.000Z",
            "2026-01-07T02:00:00.000Z..2026-01-07T03:00:00.000Z",
            "2026-01-07T03:00:00.000Z..2026-01-07T04:00:00.000Z",
        ])
    })

    it("cuts the opening hours to a window that starts after the day opened", () => {
        const { slots } = freeSlotsOf({
            window: span("2026-01-06T03:00:00Z", "2026-01-06T10:00:00Z"),
            busy: [],
            durationMs: 30 * MIN,
            stepMs: 30 * MIN,
            hours: { fromMinutes: 9 * 60, toMinutes: 11 * 60, timeZone: "Asia/Ho_Chi_Minh" },
            limit: 20,
        })
        expect(isoOf(slots)).toEqual(["2026-01-06T03:00:00.000Z..2026-01-06T03:30:00.000Z", "2026-01-06T03:30:00.000Z..2026-01-06T04:00:00.000Z"])
    })

    it("keeps the local hours across a daylight saving change (New York, 2026-03-08 spring forward)", () => {
        // Before the change the offset is -05:00 (09:00 = 14:00Z); after it -04:00 (09:00 = 13:00Z).
        const { slots } = freeSlotsOf({
            window: span("2026-03-07T00:00:00Z", "2026-03-10T00:00:00Z"),
            busy: [],
            durationMs: 60 * MIN,
            stepMs: 60 * MIN,
            hours: { fromMinutes: 9 * 60, toMinutes: 10 * 60, timeZone: "America/New_York" },
            limit: 20,
        })
        expect(isoOf(slots)).toEqual([
            "2026-03-07T14:00:00.000Z..2026-03-07T15:00:00.000Z",
            "2026-03-08T13:00:00.000Z..2026-03-08T14:00:00.000Z",
            "2026-03-09T13:00:00.000Z..2026-03-09T14:00:00.000Z",
        ])
    })

    it("treats a closing time of 24:00 as the next local midnight", () => {
        const { slots } = freeSlotsOf({
            window: span("2026-01-06T00:00:00Z", "2026-01-07T00:00:00Z"),
            busy: [],
            durationMs: 120 * MIN,
            stepMs: 120 * MIN,
            hours: { fromMinutes: 22 * 60, toMinutes: 1440, timeZone: "Asia/Ho_Chi_Minh" },
            limit: 20,
        })
        // 22:00-24:00 local on Jan 6 = 15:00Z-17:00Z; Jan 5's evening ends at 17:00Z on Jan 5, before the window.
        expect(isoOf(slots)).toEqual(["2026-01-06T15:00:00.000Z..2026-01-06T17:00:00.000Z"])
    })
})

describe("zone helpers", () => {
    let isoInZone: typeof isoInZoneSubject
    let offsetMsOf: typeof offsetMsOfSubject
    let zonedInstantMs: typeof zonedInstantMsSubject

    beforeAll(async () => {
        ;({ isoInZone, offsetMsOf, zonedInstantMs } = await build())
    })

    it("reads the offset of a zone at an instant", () => {
        expect(offsetMsOf(at("2026-01-06T00:00:00Z"), "Asia/Ho_Chi_Minh")).toBe(7 * 60 * MIN)
        expect(offsetMsOf(at("2026-01-06T00:00:00Z"), "UTC")).toBe(0)
        expect(offsetMsOf(at("2026-07-01T00:00:00Z"), "America/New_York")).toBe(-4 * 60 * MIN)
    })

    it("finds the instant of a wall time", () => {
        expect(new Date(zonedInstantMs(2026, 1, 6, 9 * 60, "Asia/Ho_Chi_Minh")).toISOString()).toBe("2026-01-06T02:00:00.000Z")
        expect(new Date(zonedInstantMs(2026, 3, 9, 9 * 60, "America/New_York")).toISOString()).toBe("2026-03-09T13:00:00.000Z")
    })

    it("writes an instant with the zone's own offset", () => {
        expect(isoInZone(at("2026-01-06T02:30:00Z"), "Asia/Ho_Chi_Minh")).toBe("2026-01-06T09:30:00+07:00")
        expect(isoInZone(at("2026-01-06T02:30:00Z"), "UTC")).toBe("2026-01-06T02:30:00Z")
        expect(isoInZone(at("2026-03-09T13:00:00Z"), "America/New_York")).toBe("2026-03-09T09:00:00-04:00")
        expect(isoInZone(at("2026-01-06T02:30:00Z"), "Asia/Kolkata")).toBe("2026-01-06T08:00:00+05:30")
    })
})
