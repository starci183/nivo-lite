import {
    amountOf,
    toBookable,
    toBoardBooking,
    toBoardException,
    toBoardResource,
    toBoardService,
    toBoardWait,
    toDateException,
    toFigureRow,
    toLeaveDay,
    toResource,
    toSettings,
    toTakenSpan,
    toWeeklyHours,
} from "./booking-model.mapper"

const as = <T>(value: object): T => value as unknown as T

const serviceOf = (over: object = {}) =>
    as<never>({
        id: "svc-1",
        name: "Cut",
        description: "d",
        durationMin: 30,
        bufferMin: 5,
        priceVnd: "200000",
        resourceKind: "staff",
        active: true,
        followupDays: 14,
        ...over,
    })

const resourceOf = () =>
    as<never>({
        id: "res-1",
        name: "Chair",
        kind: "chair",
        capacity: 2,
        active: true,
        sortOrder: 3,
        color: "#fff",
        staffId: "staff-1",
    })

const exceptionOf = (over: object = {}) =>
    as<never>({
        id: "ex-1",
        resourceId: "res-1",
        onDate: "2026-03-02",
        closed: false,
        startTime: "09:00:00",
        endTime: "12:00:00",
        note: "half day",
        ...over,
    })

const factsOf = (over: object = {}) =>
    as<never>({
        id: "b-1",
        customer_name: "An",
        customer_phone: "090",
        service_id: "svc-1",
        service_name: "Cut",
        resource_id: "res-1",
        start_ms: Date.UTC(2026, 2, 2, 9, 30),
        end_ms: Date.UTC(2026, 2, 2, 10, 15),
        status: "confirmed",
        holds_slot: true,
        party_size: 2,
        price_vnd: 200000,
        deposit_vnd: 50000,
        deposit_status: "paid",
        cancel_fee_vnd: 0,
        checked_in: false,
        note: "n",
        conflict_note: null,
        source_channel: "web",
        lead_id: "lead-1",
        reschedule_count: 1,
        ...over,
    })

const bookingOf = () =>
    as<never>({
        id: "b-1",
        resourceId: "res-1",
        status: "confirmed",
        partySize: 2,
        startAt: new Date(Date.UTC(2026, 2, 2, 9, 30)),
        endAt: new Date(Date.UTC(2026, 2, 2, 10, 15)),
        blockEndAt: new Date(Date.UTC(2026, 2, 2, 10, 30)),
        priceVnd: "200000",
    })

const BOOKABLE = {
    id: "svc-1",
    name: "Cut",
    description: "d",
    durationMin: 30,
    bufferMin: 5,
    priceVnd: 200000,
    resourceKind: "staff",
    active: true,
}

const RESOURCE = { id: "res-1", name: "Chair", kind: "chair", capacity: 2, active: true, sort: 3 }

describe("booking model mapper", () => {
    it("reads a bigint column that may be null", () => {
        expect(amountOf(null)).toBeNull()
        expect(amountOf("1500")).toBe(1500)
    })

    it("maps the settings", () => {
        expect(
            toSettings(
                as({
                    timezone: "Asia/Ho_Chi_Minh",
                    slotStepMin: 15,
                    minLeadMin: 60,
                    maxAdvanceDays: 30,
                    cancelWindowHours: 24,
                    depositPct: 20,
                    lateCancelFeePct: 50,
                    noShowFeeVnd: "100000",
                    autoConfirm: true,
                    handoffOrder: ["a"],
                    reminderHours: [24],
                    publicEnabled: true,
                    publicSlug: "salon",
                    publicNote: "hi",
                    address: "1 Street",
                }),
            ),
        ).toEqual({
            timezone: "Asia/Ho_Chi_Minh",
            slotStepMin: 15,
            minLeadMin: 60,
            maxAdvanceDays: 30,
            cancelWindowHours: 24,
            depositPct: 20,
            lateCancelFeePct: 50,
            noShowFeeVnd: 100000,
            autoConfirm: true,
            handoffOrder: ["a"],
            reminderHours: [24],
            publicEnabled: true,
            publicSlug: "salon",
            publicNote: "hi",
            address: "1 Street",
        })
    })

    it("maps services and resources", () => {
        expect(toBookable(serviceOf())).toEqual(BOOKABLE)
        expect(toBookable(serviceOf({ priceVnd: null })).priceVnd).toBeNull()
        expect(toResource(resourceOf())).toEqual(RESOURCE)
        expect(toBoardService(serviceOf())).toEqual({ ...BOOKABLE, followupDays: 14 })
        expect(toBoardResource(resourceOf())).toEqual({ ...RESOURCE, color: "#fff", staffId: "staff-1" })
    })

    it("maps weekly hours to HH:MM", () => {
        expect(
            toWeeklyHours(as({ resourceId: "res-1", weekday: 2, startTime: "09:00:00", endTime: "17:30:00" })),
        ).toEqual({ resourceId: "res-1", weekday: 2, start: "09:00", end: "17:30" })
    })

    it("maps exceptions with and without hours", () => {
        expect(toDateException(exceptionOf())).toEqual({
            resourceId: "res-1",
            date: "2026-03-02",
            closed: false,
            start: "09:00",
            end: "12:00",
        })
        expect(toDateException(exceptionOf({ closed: true, startTime: null, endTime: null }))).toEqual({
            resourceId: "res-1",
            date: "2026-03-02",
            closed: true,
            start: null,
            end: null,
        })
        expect(toBoardException(exceptionOf())).toEqual({
            resourceId: "res-1",
            date: "2026-03-02",
            closed: false,
            start: "09:00",
            end: "12:00",
            id: "ex-1",
            note: "half day",
        })
    })

    it("maps held spans, leave days and figure rows", () => {
        expect(toTakenSpan(bookingOf())).toEqual({
            id: "b-1",
            resourceId: "res-1",
            startMs: Date.UTC(2026, 2, 2, 9, 30),
            blockEndMs: Date.UTC(2026, 2, 2, 10, 30),
            partySize: 2,
        })
        expect(
            toLeaveDay(
                as({ resource_id: "res-1", leave_staff: "staff-1", from_date: "2026-03-02", to_date: "2026-03-04" }),
            ),
        ).toEqual({ resourceId: "res-1", staffId: "staff-1", fromDate: "2026-03-02", toDate: "2026-03-04" })
        expect(toFigureRow(bookingOf())).toEqual({
            status: "confirmed",
            resourceId: "res-1",
            partySize: 2,
            startMs: Date.UTC(2026, 2, 2, 9, 30),
            endMs: Date.UTC(2026, 2, 2, 10, 15),
            priceVnd: 200000,
        })
    })

    it("maps a same-day appointment into wall-clock coordinates", () => {
        expect(toBoardBooking(factsOf(), "UTC")).toEqual({
            id: "b-1",
            customer: "An",
            phone: "090",
            serviceId: "svc-1",
            service: "Cut",
            resourceId: "res-1",
            startMs: Date.UTC(2026, 2, 2, 9, 30),
            endMs: Date.UTC(2026, 2, 2, 10, 15),
            date: "2026-03-02",
            startMin: 570,
            endMin: 615,
            startClock: "09:30",
            endClock: "10:15",
            status: "confirmed",
            holdsSlot: true,
            party: 2,
            priceVnd: 200000,
            depositVnd: 50000,
            depositStatus: "paid",
            feeVnd: 0,
            checkedIn: false,
            note: "n",
            conflictNote: null,
            source: "web",
            leadId: "lead-1",
            reschedules: 1,
        })
    })

    it("closes an appointment that runs past midnight at 24:00", () => {
        const entry = toBoardBooking(factsOf({ end_ms: Date.UTC(2026, 2, 3, 1, 0) }), "UTC")

        expect(entry.endClock).toBe("24:00")
        expect(entry.endMin).toBe(1440)
        expect(entry.startMin).toBe(570)
    })

    it("maps a waiting customer", () => {
        expect(
            toBoardWait(
                as({
                    id: "w-1",
                    customer_name: "Binh",
                    customer_phone: "091",
                    service_name: "Cut",
                    from_ms: 1,
                    to_ms: 2,
                    party_size: 3,
                    status: "waiting",
                }),
            ),
        ).toEqual({
            id: "w-1",
            customer: "Binh",
            phone: "091",
            service: "Cut",
            fromMs: 1,
            toMs: 2,
            party: 3,
            status: "waiting",
        })
    })
})
