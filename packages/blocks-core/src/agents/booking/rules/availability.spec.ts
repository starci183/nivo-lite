import { zoneMomentMs } from "../../../shared/rules/zone-time"
import type { DateException, PlanInput, SlotResource, SlotService, TakenSpan, WeeklyWindow } from "./availability"
import { checkSlot, findSlots, firstSlots, nearestSlots, peakLoad, windowsOf } from "./availability"
import { reminderDue } from "./booking"

const TZ = "Asia/Ho_Chi_Minh"
const at = (date: string, hhmm: string): number =>
    zoneMomentMs(date, Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)), TZ)

const resourceOf = (over: Partial<SlotResource> = {}): SlotResource => ({
    id: "r1",
    name: "Anna",
    kind: "person",
    capacity: 1,
    active: true,
    sort: 0,
    ...over,
})
const serviceOf = (over: Partial<SlotService> = {}): SlotService => ({
    id: "s1",
    durationMin: 60,
    bufferMin: 0,
    resourceKind: null,
    active: true,
    ...over,
})
const hoursOf = (over: Partial<WeeklyWindow> = {}): WeeklyWindow => ({
    resourceId: "r1",
    weekday: 1,
    start: "09:00",
    end: "12:00",
    ...over,
})
const exceptionOf = (over: Partial<DateException> = {}): DateException => ({
    resourceId: null,
    date: "2026-10-12",
    closed: true,
    start: null,
    end: null,
    ...over,
})
const spanOf = (over: Partial<TakenSpan> = {}): TakenSpan => ({
    id: "b1",
    resourceId: "r1",
    startMs: at("2026-10-12", "09:00"),
    blockEndMs: at("2026-10-12", "10:00"),
    partySize: 1,
    ...over,
})

/** Sunday midnight before the Monday 2026-10-12 the fixtures plan in. */
const NOW = at("2026-10-12", "00:00") - 86_400_000
const planOf = (over: Partial<PlanInput> = {}): PlanInput => ({
    service: serviceOf(),
    resources: [resourceOf()],
    hours: [hoursOf()],
    exceptions: [],
    taken: [],
    policy: { timeZone: TZ, slotStepMin: 60, minLeadMin: 0, maxAdvanceDays: 30 },
    nowMs: NOW,
    ...over,
})
const DAY = { from: at("2026-10-12", "00:00"), to: at("2026-10-13", "00:00") }
const startsOf = (input: PlanInput): ReadonlyArray<number> => findSlots(input, DAY.from, DAY.to).map((s) => s.startMs)

describe("booking availability: windowsOf", () => {
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
        expect(windowsOf(resource, "2026-10-12", [hoursOf({ start: "12:00", end: "09:00" })], [], TZ)).toEqual([])
    })

    it("closes the day for a closed exception of the resource or of the whole business", () => {
        expect(windowsOf(resource, "2026-10-12", [hoursOf()], [exceptionOf({ resourceId: "r1" })], TZ)).toEqual([])
        expect(windowsOf(resource, "2026-10-12", [hoursOf()], [exceptionOf()], TZ)).toEqual([])
    })

    it("lets the exception of the resource win over the one of the business", () => {
        const exceptions = [exceptionOf(), exceptionOf({ resourceId: "r1", closed: false, start: "14:00:00", end: "16:00:00" })]
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

    it("falls back to the weekly hours when an open exception names no times, and ignores other dates", () => {
        expect(windowsOf(resource, "2026-10-12", [hoursOf()], [exceptionOf({ closed: false })], TZ)).toHaveLength(1)
        expect(windowsOf(resource, "2026-10-12", [hoursOf()], [exceptionOf({ date: "2026-10-13" })], TZ)).toHaveLength(1)
    })
})

describe("booking availability: peakLoad", () => {
    const from = at("2026-10-12", "09:00")
    const to = at("2026-10-12", "11:00")

    it("is zero without overlapping spans", () => {
        expect(peakLoad([], "r1", from, to, null)).toBe(0)
        expect(peakLoad([spanOf({ resourceId: "other" })], "r1", from, to, null)).toBe(0)
        expect(peakLoad([spanOf({ startMs: to, blockEndMs: to + 1000 })], "r1", from, to, null)).toBe(0)
        expect(peakLoad([spanOf({ startMs: from - 1000, blockEndMs: from })], "r1", from, to, null)).toBe(0)
    })

    it("counts the party of a span that overlaps, and leaves out the excluded booking", () => {
        expect(peakLoad([spanOf({ partySize: 3 })], "r1", from, to, null)).toBe(3)
        expect(peakLoad([spanOf()], "r1", from, to, "b1")).toBe(0)
    })

    it("adds the spans that meet at one moment and not those that follow each other", () => {
        const overlapping = [spanOf({ startMs: from, blockEndMs: to }), spanOf({ id: "b2", startMs: from + 1000, blockEndMs: to })]
        expect(peakLoad(overlapping, "r1", from, to, null)).toBe(2)
        const sequential = [
            spanOf({ startMs: from, blockEndMs: from + 3_600_000 }),
            spanOf({ id: "b2", startMs: from + 3_600_000, blockEndMs: to }),
        ]
        expect(peakLoad(sequential, "r1", from, to, null)).toBe(1)
    })
})

describe("booking availability: findSlots", () => {
    it("lists a start per step inside the opening hours, with the end and the buffered end", () => {
        expect(startsOf(planOf())).toEqual([at("2026-10-12", "09:00"), at("2026-10-12", "10:00"), at("2026-10-12", "11:00")])
        const [first] = findSlots(planOf({ service: serviceOf({ durationMin: 30, bufferMin: 15 }) }), DAY.from, DAY.to)
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
            policy: { timeZone: TZ, slotStepMin: 1, minLeadMin: 0, maxAdvanceDays: 30 },
        })
        expect(startsOf(input).slice(0, 2)).toEqual([at("2026-10-12", "09:00"), at("2026-10-12", "09:05")])
    })

    it("offers nothing for an inactive service or when the range is empty after the lead time", () => {
        expect(startsOf(planOf({ service: serviceOf({ active: false }) }))).toEqual([])
        expect(startsOf(planOf({ policy: { timeZone: TZ, slotStepMin: 60, minLeadMin: 99_999, maxAdvanceDays: 30 } }))).toEqual(
            [],
        )
    })

    it("keeps the minimum lead time and stops at the advance limit", () => {
        const lead = planOf({
            nowMs: at("2026-10-12", "09:30"),
            policy: { timeZone: TZ, slotStepMin: 60, minLeadMin: 30, maxAdvanceDays: 30 },
        })
        expect(startsOf(lead)).toEqual([at("2026-10-12", "10:00"), at("2026-10-12", "11:00")])
        const far = planOf({ policy: { timeZone: TZ, slotStepMin: 60, minLeadMin: 0, maxAdvanceDays: 2 } })
        expect(findSlots(far, at("2026-10-12", "00:00"), at("2026-10-20", "00:00"))).toHaveLength(3)
    })

    it("skips a resource that cannot hold the party", () => {
        expect(startsOf(planOf({ partySize: 2 }))).toEqual([])
        expect(startsOf(planOf({ partySize: 2, resources: [resourceOf({ capacity: 2 })] }))).toHaveLength(3)
    })

    it("restricts to the asked resource and the kind the service needs", () => {
        const resources = [resourceOf(), resourceOf({ id: "r2", name: "Binh", kind: "room", sort: 1 })]
        const hours = [hoursOf(), hoursOf({ resourceId: "r2" })]
        const ids = (input: PlanInput): Set<string> => new Set(findSlots(input, DAY.from, DAY.to).map((s) => s.resourceId))
        expect(ids(planOf({ resources, hours }))).toEqual(new Set(["r1", "r2"]))
        expect(ids(planOf({ resources, hours, service: serviceOf({ resourceKind: "room" }) }))).toEqual(new Set(["r2"]))
        expect(ids(planOf({ resources, hours, resourceId: "r1" }))).toEqual(new Set(["r1"]))
        expect(startsOf(planOf({ resources: [resourceOf({ active: false })] }))).toEqual([])
    })

    it("orders resources by sort, then by name, and slots by start then resource", () => {
        const resources = [
            resourceOf({ id: "r2", name: "Binh", sort: 1 }),
            resourceOf({ id: "r1", name: "Zed", sort: 0 }),
            resourceOf({ id: "r3", name: "Ann", sort: 1 }),
        ]
        const hours = [hoursOf(), hoursOf({ resourceId: "r2" }), hoursOf({ resourceId: "r3" })]
        expect(findSlots(planOf({ resources, hours }), DAY.from, DAY.to).slice(0, 3).map((s) => s.resourceId)).toEqual([
            "r1",
            "r2",
            "r3",
        ])
    })

    it("leaves out start times a booking holds, buffer included, but not the excluded booking", () => {
        const held = planOf({
            service: serviceOf({ bufferMin: 30 }),
            taken: [spanOf({ startMs: at("2026-10-12", "10:00"), blockEndMs: at("2026-10-12", "11:00") })],
        })
        expect(startsOf(held)).toEqual([at("2026-10-12", "11:00")])
        expect(startsOf(planOf({ taken: [spanOf()], excludeId: "b1" }))).toHaveLength(3)
        expect(startsOf(planOf({ taken: [spanOf()] }))).toHaveLength(2)
    })

    it("shares a resource of capacity up to the party count", () => {
        const input = planOf({ resources: [resourceOf({ capacity: 2 })], taken: [spanOf({ partySize: 1 })], partySize: 1 })
        expect(startsOf(input)).toHaveLength(3)
        expect(startsOf({ ...input, taken: [spanOf({ partySize: 2 })] })).toHaveLength(2)
    })
})

describe("booking availability: checkSlot", () => {
    const nineAm = at("2026-10-12", "09:00")

    it("answers the slot of a free start", () => {
        expect(checkSlot(planOf(), nineAm)).toEqual({
            ok: true,
            slot: { startMs: nineAm, endMs: at("2026-10-12", "10:00"), blockEndMs: at("2026-10-12", "10:00"), resourceId: "r1" },
        })
    })

    it("refuses an inactive service, a business without a fitting resource, a start too soon or too far", () => {
        expect(checkSlot(planOf({ service: serviceOf({ active: false }) }), nineAm)).toEqual({ ok: false, why: "no_service" })
        expect(checkSlot(planOf({ resources: [] }), nineAm)).toEqual({ ok: false, why: "no_resource" })
        const lead = planOf({ policy: { timeZone: TZ, slotStepMin: 60, minLeadMin: 60 * 24 * 2, maxAdvanceDays: 30 } })
        expect(checkSlot(lead, nineAm)).toEqual({ ok: false, why: "too_soon" })
        const far = planOf({ policy: { timeZone: TZ, slotStepMin: 60, minLeadMin: 0, maxAdvanceDays: 1 } })
        expect(checkSlot(far, at("2026-10-20", "09:00"))).toEqual({ ok: false, why: "too_far" })
    })

    it("explains a start nobody can take as full inside opening hours and closed outside them", () => {
        expect(checkSlot(planOf({ taken: [spanOf()] }), nineAm)).toEqual({ ok: false, why: "full" })
        expect(checkSlot(planOf(), at("2026-10-12", "20:00"))).toEqual({ ok: false, why: "closed" })
    })

    it("picks the least loaded resource and the first one on a tie", () => {
        const resources = [resourceOf({ id: "r1", capacity: 4, sort: 0 }), resourceOf({ id: "r2", name: "Binh", capacity: 4, sort: 1 })]
        const hours = [hoursOf(), hoursOf({ resourceId: "r2" })]
        const loaded = checkSlot(planOf({ resources, hours, taken: [spanOf({ resourceId: "r1", partySize: 2 })] }), nineAm)
        expect(loaded.ok && loaded.slot.resourceId).toBe("r2")
        const tie = checkSlot(planOf({ resources, hours }), nineAm)
        expect(tie.ok && tie.slot.resourceId).toBe("r1")
    })
})

describe("booking availability: nearestSlots and firstSlots", () => {
    const wanted = at("2026-10-12", "10:00")
    const resources = [resourceOf(), resourceOf({ id: "r2", name: "Binh", sort: 1 })]
    const hours = [hoursOf(), hoursOf({ resourceId: "r2" })]

    it("returns the closest distinct start times, earliest first", () => {
        expect(nearestSlots(planOf({ resources, hours }), wanted, 3, 7).map((s) => s.startMs)).toEqual([
            at("2026-10-12", "09:00"),
            wanted,
            at("2026-10-12", "11:00"),
        ])
        expect(nearestSlots(planOf({ resources: [] }), wanted, 3, 7)).toEqual([])
    })

    it("returns the earliest distinct start times, at most the count, the first resource of each", () => {
        const first = firstSlots(planOf({ resources, hours }), DAY.from, DAY.to, 2)
        expect(first.map((s) => [s.startMs, s.resourceId])).toEqual([
            [at("2026-10-12", "09:00"), "r1"],
            [at("2026-10-12", "10:00"), "r1"],
        ])
    })
})

describe("booking reminderDue", () => {
    const now = at("2026-10-12", "09:00")

    it("is due for a confirmed, unreminded booking that starts within the hours and is not started", () => {
        expect(reminderDue({ status: "confirmed", startMs: now + 3_600_000, remindedAt: null }, now, 24)).toBe(true)
        expect(reminderDue({ status: "requested", startMs: now + 3_600_000, remindedAt: null }, now, 24)).toBe(false)
        expect(reminderDue({ status: "confirmed", startMs: now + 3_600_000, remindedAt: "2026-10-11T00:00:00.000Z" }, now, 24)).toBe(
            false,
        )
        expect(reminderDue({ status: "confirmed", startMs: now - 1, remindedAt: null }, now, 24)).toBe(false)
        expect(reminderDue({ status: "confirmed", startMs: now + 25 * 3_600_000, remindedAt: null }, now, 24)).toBe(false)
    })
})
