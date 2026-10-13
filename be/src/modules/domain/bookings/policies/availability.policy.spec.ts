import { builder } from "@starci/jest-preset"
import type {
    BookingResource,
    DateException,
    PlanInput,
    ServiceSpec,
    TakenSpan,
    WeeklyHours,
} from "../bookings.contracts"
import { checkSlot, findSlots, nearestSlots, peakLoad, utilisation, windowsOf } from "./availability.policy"
import { zonedMs } from "./zoned-time.policy"

const TZ = "Asia/Ho_Chi_Minh"
const at = (date: string, hhmm: string): number => zonedMs(date, hhmm, TZ)

const resourceOf = builder<BookingResource>({
    id: "r1",
    name: "Anna",
    kind: "staff",
    capacity: 1,
    active: true,
    sort: 0,
})
const serviceOf = builder<ServiceSpec>({ id: "s1", durationMin: 60, bufferMin: 0, resourceKind: null, active: true })
const hoursOf = builder<WeeklyHours>({ resourceId: "r1", weekday: 1, start: "09:00", end: "12:00" })
const exceptionOf = builder<DateException>({
    resourceId: null,
    date: "2026-10-12",
    closed: true,
    start: null,
    end: null,
})
const spanOf = builder<TakenSpan>({
    id: "b1",
    resourceId: "r1",
    startMs: at("2026-10-12", "09:00"),
    blockEndMs: at("2026-10-12", "10:00"),
    partySize: 1,
})

/** Sunday midnight before the Monday 2026-10-12 the fixtures plan in. */
const NOW = at("2026-10-12", "00:00") - 86_400_000
const planOf = builder<PlanInput>({
    service: serviceOf(),
    resources: [resourceOf()],
    hours: [hoursOf()],
    exceptions: [],
    taken: [],
    policy: { timezone: TZ, slotStepMin: 60, minLeadMin: 0, maxAdvanceDays: 30 },
    nowMs: NOW,
})
const DAY = { from: at("2026-10-12", "00:00"), to: at("2026-10-13", "00:00") }
const startsOf = (input: PlanInput): ReadonlyArray<number> => findSlots(input, DAY.from, DAY.to).map((s) => s.startMs)

describe("availability.policy", () => {
    describe("windowsOf", () => {
        const resource = resourceOf()

        it("reads the weekly hours of the weekday, earliest window first", () => {
            const hours = [
                hoursOf({ start: "13:00:00", end: "17:00:00" }),
                hoursOf({ start: "09:00", end: "12:00" }),
                hoursOf({ weekday: 2 }),
                hoursOf({ resourceId: "other" }),
            ]
            expect(windowsOf(resource, "2026-10-12", hours, [], TZ)).toEqual([
                { startMs: at("2026-10-12", "09:00"), endMs: at("2026-10-12", "12:00") },
                { startMs: at("2026-10-12", "13:00"), endMs: at("2026-10-12", "17:00") },
            ])
        })

        it("drops a window that ends before it starts", () => {
            const hours = [hoursOf({ start: "12:00", end: "09:00" })]
            expect(windowsOf(resource, "2026-10-12", hours, [], TZ)).toEqual([])
        })

        it("closes the day for a closed exception of the resource", () => {
            const exceptions = [exceptionOf({ resourceId: "r1" })]
            expect(windowsOf(resource, "2026-10-12", [hoursOf()], exceptions, TZ)).toEqual([])
        })

        it("closes the day for a closed exception of the whole business", () => {
            expect(windowsOf(resource, "2026-10-12", [hoursOf()], [exceptionOf()], TZ)).toEqual([])
        })

        it("lets the exception of the resource win over the one of the business", () => {
            const exceptions = [
                exceptionOf(),
                exceptionOf({ resourceId: "r1", closed: false, start: "14:00:00", end: "16:00:00" }),
            ]
            expect(windowsOf(resource, "2026-10-12", [hoursOf()], exceptions, TZ)).toEqual([
                { startMs: at("2026-10-12", "14:00"), endMs: at("2026-10-12", "16:00") },
            ])
        })

        it("uses the open exception of the business when the resource has none", () => {
            const exceptions = [exceptionOf({ closed: false, start: "10:00", end: "11:00" })]
            expect(windowsOf(resource, "2026-10-12", [hoursOf()], exceptions, TZ)).toEqual([
                { startMs: at("2026-10-12", "10:00"), endMs: at("2026-10-12", "11:00") },
            ])
        })

        it("falls back to the weekly hours when an open exception names no times", () => {
            const exceptions = [exceptionOf({ closed: false })]
            expect(windowsOf(resource, "2026-10-12", [hoursOf()], exceptions, TZ)).toHaveLength(1)
        })

        it("ignores exceptions of other dates", () => {
            const exceptions = [exceptionOf({ date: "2026-10-13" })]
            expect(windowsOf(resource, "2026-10-12", [hoursOf()], exceptions, TZ)).toHaveLength(1)
        })
    })

    describe("peakLoad", () => {
        const from = at("2026-10-12", "09:00")
        const to = at("2026-10-12", "11:00")

        it("is zero without overlapping spans", () => {
            expect(peakLoad([], "r1", from, to, null)).toBe(0)
            expect(peakLoad([spanOf({ resourceId: "other" })], "r1", from, to, null)).toBe(0)
            expect(peakLoad([spanOf({ startMs: to, blockEndMs: to + 1000 })], "r1", from, to, null)).toBe(0)
            expect(peakLoad([spanOf({ startMs: from - 1000, blockEndMs: from })], "r1", from, to, null)).toBe(0)
        })

        it("counts the party of a span that overlaps", () => {
            expect(peakLoad([spanOf({ partySize: 3 })], "r1", from, to, null)).toBe(3)
        })

        it("adds the spans that meet at one moment and not those that follow each other", () => {
            const overlapping = [
                spanOf({ startMs: from, blockEndMs: to }),
                spanOf({ id: "b2", startMs: from + 1000, blockEndMs: to }),
            ]
            expect(peakLoad(overlapping, "r1", from, to, null)).toBe(2)
            const sequential = [
                spanOf({ startMs: from, blockEndMs: from + 3_600_000 }),
                spanOf({ id: "b2", startMs: from + 3_600_000, blockEndMs: to }),
            ]
            expect(peakLoad(sequential, "r1", from, to, null)).toBe(1)
        })

        it("leaves out the excluded booking", () => {
            expect(peakLoad([spanOf()], "r1", from, to, "b1")).toBe(0)
        })
    })

    describe("findSlots", () => {
        it("lists a start per step inside the opening hours", () => {
            expect(startsOf(planOf())).toEqual([
                at("2026-10-12", "09:00"),
                at("2026-10-12", "10:00"),
                at("2026-10-12", "11:00"),
            ])
        })

        it("answers the end and the buffered end of each slot", () => {
            const input = planOf({ service: serviceOf({ durationMin: 30, bufferMin: 15 }) })
            const [first] = findSlots(input, DAY.from, DAY.to)
            expect(first).toEqual({
                startMs: at("2026-10-12", "09:00"),
                endMs: at("2026-10-12", "09:30"),
                blockEndMs: at("2026-10-12", "09:45"),
                resourceId: "r1",
            })
        })

        it("never uses a step below five minutes", () => {
            const input = planOf({
                service: serviceOf({ durationMin: 5 }),
                policy: { timezone: TZ, slotStepMin: 1, minLeadMin: 0, maxAdvanceDays: 30 },
            })
            expect(startsOf(input).slice(0, 2)).toEqual([at("2026-10-12", "09:00"), at("2026-10-12", "09:05")])
        })

        it("offers nothing for an inactive service", () => {
            expect(startsOf(planOf({ service: serviceOf({ active: false }) }))).toEqual([])
        })

        it("offers nothing when the range is empty after the lead time", () => {
            const input = planOf({ policy: { timezone: TZ, slotStepMin: 60, minLeadMin: 99_999, maxAdvanceDays: 30 } })
            expect(startsOf(input)).toEqual([])
        })

        it("keeps the minimum lead time", () => {
            const input = planOf({
                nowMs: at("2026-10-12", "09:30"),
                policy: { timezone: TZ, slotStepMin: 60, minLeadMin: 30, maxAdvanceDays: 30 },
            })
            expect(startsOf(input)).toEqual([at("2026-10-12", "10:00"), at("2026-10-12", "11:00")])
        })

        it("stops at the advance limit", () => {
            const input = planOf({ policy: { timezone: TZ, slotStepMin: 60, minLeadMin: 0, maxAdvanceDays: 2 } })
            expect(findSlots(input, at("2026-10-12", "00:00"), at("2026-10-20", "00:00"))).toHaveLength(3)
        })

        it("skips a resource that cannot hold the party", () => {
            expect(startsOf(planOf({ partySize: 2 }))).toEqual([])
            expect(startsOf(planOf({ partySize: 2, resources: [resourceOf({ capacity: 2 })] }))).toHaveLength(3)
        })

        it("restricts to the asked resource and the kind the service needs", () => {
            const resources = [resourceOf(), resourceOf({ id: "r2", name: "Binh", kind: "room", sort: 1 })]
            const hours = [hoursOf(), hoursOf({ resourceId: "r2" })]
            const base = planOf({ resources, hours })
            expect(new Set(findSlots(base, DAY.from, DAY.to).map((s) => s.resourceId))).toEqual(new Set(["r1", "r2"]))
            const onlyRoom = planOf({ resources, hours, service: serviceOf({ resourceKind: "room" }) })
            expect(new Set(findSlots(onlyRoom, DAY.from, DAY.to).map((s) => s.resourceId))).toEqual(new Set(["r2"]))
            const asked = planOf({ resources, hours, resourceId: "r1" })
            expect(new Set(findSlots(asked, DAY.from, DAY.to).map((s) => s.resourceId))).toEqual(new Set(["r1"]))
            const inactive = planOf({ resources: [resourceOf({ active: false })] })
            expect(startsOf(inactive)).toEqual([])
        })

        it("orders resources by sort, then by name, and slots by start then resource", () => {
            const resources = [
                resourceOf({ id: "r2", name: "Binh", sort: 1 }),
                resourceOf({ id: "r1", name: "Zed", sort: 0 }),
                resourceOf({ id: "r3", name: "Ann", sort: 1 }),
            ]
            const hours = [hoursOf(), hoursOf({ resourceId: "r2" }), hoursOf({ resourceId: "r3" })]
            const first = findSlots(planOf({ resources, hours }), DAY.from, DAY.to).slice(0, 3)
            expect(first.map((s) => s.resourceId)).toEqual(["r1", "r2", "r3"])
        })

        it("leaves out start times a booking holds, buffer included", () => {
            const input = planOf({
                service: serviceOf({ bufferMin: 30 }),
                taken: [spanOf({ startMs: at("2026-10-12", "10:00"), blockEndMs: at("2026-10-12", "11:00") })],
            })
            expect(startsOf(input)).toEqual([at("2026-10-12", "11:00")])
        })

        it("does not let the excluded booking block itself", () => {
            const input = planOf({ taken: [spanOf()], excludeId: "b1" })
            expect(startsOf(input)).toHaveLength(3)
            expect(startsOf(planOf({ taken: [spanOf()] }))).toHaveLength(2)
        })

        it("shares a resource of capacity up to the party count", () => {
            const input = planOf({
                resources: [resourceOf({ capacity: 2 })],
                taken: [spanOf({ partySize: 1 })],
                partySize: 1,
            })
            expect(startsOf(input)).toHaveLength(3)
            expect(startsOf(planOf({ ...input, taken: [spanOf({ partySize: 2 })] }))).toHaveLength(2)
        })
    })

    describe("checkSlot", () => {
        const nineAm = at("2026-10-12", "09:00")

        it("answers the slot of a free start", () => {
            expect(checkSlot(planOf(), nineAm)).toEqual({
                ok: true,
                slot: {
                    startMs: nineAm,
                    endMs: at("2026-10-12", "10:00"),
                    blockEndMs: at("2026-10-12", "10:00"),
                    resourceId: "r1",
                },
            })
        })

        it("refuses an inactive service and a business without a fitting resource", () => {
            expect(checkSlot(planOf({ service: serviceOf({ active: false }) }), nineAm)).toEqual({
                ok: false,
                why: "no_service",
            })
            expect(checkSlot(planOf({ resources: [] }), nineAm)).toEqual({ ok: false, why: "no_resource" })
        })

        it("refuses a start that is too soon or too far", () => {
            const lead = planOf({
                policy: { timezone: TZ, slotStepMin: 60, minLeadMin: 60 * 24 * 2, maxAdvanceDays: 30 },
            })
            expect(checkSlot(lead, nineAm)).toEqual({ ok: false, why: "too_soon" })
            const far = planOf({ policy: { timezone: TZ, slotStepMin: 60, minLeadMin: 0, maxAdvanceDays: 1 } })
            expect(checkSlot(far, at("2026-10-20", "09:00"))).toEqual({ ok: false, why: "too_far" })
        })

        it("explains a start nobody can take as full inside opening hours and closed outside them", () => {
            const taken = planOf({ taken: [spanOf()] })
            expect(checkSlot(taken, nineAm)).toEqual({ ok: false, why: "full" })
            expect(checkSlot(planOf(), at("2026-10-12", "20:00"))).toEqual({ ok: false, why: "closed" })
        })

        it("picks the least loaded resource and the first one on a tie", () => {
            const resources = [
                resourceOf({ id: "r1", capacity: 4, sort: 0 }),
                resourceOf({ id: "r2", name: "Binh", capacity: 4, sort: 1 }),
            ]
            const hours = [hoursOf(), hoursOf({ resourceId: "r2" })]
            const busyFirst = planOf({ resources, hours, taken: [spanOf({ resourceId: "r1", partySize: 2 })] })
            const loaded = checkSlot(busyFirst, nineAm)
            expect(loaded.ok && loaded.slot.resourceId).toBe("r2")
            const tie = checkSlot(planOf({ resources, hours }), nineAm)
            expect(tie.ok && tie.slot.resourceId).toBe("r1")
        })
    })

    describe("nearestSlots", () => {
        const wanted = at("2026-10-12", "10:00")

        it("returns the closest distinct start times, earliest first", () => {
            const resources = [resourceOf(), resourceOf({ id: "r2", name: "Binh", sort: 1 })]
            const hours = [hoursOf(), hoursOf({ resourceId: "r2" })]
            const result = nearestSlots(planOf({ resources, hours }), wanted, 3, 7)
            expect(result.map((s) => s.startMs)).toEqual([at("2026-10-12", "09:00"), wanted, at("2026-10-12", "11:00")])
        })

        it("returns fewer slots when fewer are free and breaks distance ties by time", () => {
            const input = planOf({ policy: { timezone: TZ, slotStepMin: 60, minLeadMin: 0, maxAdvanceDays: 2 } })
            expect(nearestSlots(input, wanted, 5, 1).length).toBeLessThanOrEqual(3)
            expect(nearestSlots(planOf({ resources: [] }), wanted, 3, 7)).toEqual([])
        })
    })

    describe("utilisation", () => {
        const resources = [resourceOf(), resourceOf({ id: "r2", active: false }), resourceOf({ id: "r3", capacity: 2 })]
        const hours = [hoursOf(), hoursOf({ resourceId: "r2" })]

        it("shares the booked minutes over the open minutes of the active resources", () => {
            const result = utilisation(resources, hours, [], new Map([["r1", 90]]), "2026-10-12", "2026-10-12", TZ)
            expect(result).toEqual([
                { resourceId: "r1", name: "Anna", openMin: 180, bookedMin: 90, pct: 50 },
                { resourceId: "r3", name: "Anna", openMin: 0, bookedMin: 0, pct: 0 },
            ])
        })

        it("caps the share at one hundred percent and weighs capacity in", () => {
            const capped = utilisation(
                [resourceOf()],
                hours,
                [],
                new Map([["r1", 1000]]),
                "2026-10-12",
                "2026-10-12",
                TZ,
            )
            expect(capped[0]?.pct).toBe(100)
            const wide = [resourceOf({ capacity: 2 })]
            expect(utilisation(wide, hours, [], new Map([["r1", 180]]), "2026-10-12", "2026-10-12", TZ)[0]?.pct).toBe(
                50,
            )
        })
    })
})
