import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ToolsError, type NativeCaller } from "@modules/domain/tools"
import { CalendarRegistryService, providerRefusal } from "@modules/domain/provider-registry"
import type { CalendarEvent, CalendarPort } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import {
    CALENDAR_EVENT_CANCEL_SCHEMA,
    CALENDAR_EVENT_CREATE_SCHEMA,
    CALENDAR_EVENT_UPDATE_SCHEMA,
    CALENDAR_SLOT_FREE_LIST_SCHEMA,
} from "./calendar-native.schema"
import { CalendarNativeService } from "./calendar-native.service"
import { CALENDAR_BUSINESS_REFUSALS, CALENDAR_REFUSAL_CLASS, CALENDAR_REFUSALS } from "./calendar-refusal.policy"
import { CALENDAR_TOOL_NAME } from "./calendar-tools.tool-ids"

const account = connectionRecord({ id: "conn-1", workspaceId: "ws-1", provider: "google" })
const caller: NativeCaller = { agentId: "agent-1", conversationId: null, connectionId: "conn-1" }

const EVENT: CalendarEvent = {
    calendarId: "primary",
    eventId: "evt1",
    status: "confirmed",
    link: "https://www.google.com/calendar/event?eid=x",
    summary: "Fitting",
    start: "2026-01-06T10:00:00+07:00",
    end: "2026-01-06T10:30:00+07:00",
}

const build = async (found: ConnectionRecord | null = account) => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(found)
    const port = mock<CalendarPort>()
    Object.defineProperty(port, "provider", { value: "google" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CalendarNativeService,
            { provide: ConnectionsService, useValue: connections },
            CalendarRegistryService,
        ],
    }).compile()
    moduleRef.get(CalendarRegistryService).register(port)
    return { service: moduleRef.get(CalendarNativeService), port, connections }
}

const failure = (work: Promise<unknown>): Promise<unknown> =>
    Promise.resolve(
        work.then(
            () => undefined,
            (cause: unknown) => cause,
        ),
    )
const refusalOf = (cause: unknown): unknown => (cause instanceof ToolsError ? cause.params : cause)

describe("calendar refusals", () => {
    it("states a total class for every refusal, and business ones are exactly rejected and not_found", () => {
        expect(Object.keys(CALENDAR_REFUSAL_CLASS).sort()).toEqual([...CALENDAR_REFUSALS].sort())
        const business = CALENDAR_REFUSALS.filter((reason) => CALENDAR_REFUSAL_CLASS[reason] === "business")
        expect([...business].sort()).toEqual([...CALENDAR_BUSINESS_REFUSALS].sort())
    })
})

describe("calendar tool schemas", () => {
    const base = {
        windowStart: "2026-01-06T09:00:00+07:00",
        windowEnd: "2026-01-07T09:00:00+07:00",
        durationMinutes: 30,
    }
    const free = (value: unknown): boolean => CALENDAR_SLOT_FREE_LIST_SCHEMA.safeParse(value).success

    it("slot.free.list takes a window, a length, an optional step, zone, daily hours and limit", () => {
        expect(free(base)).toBe(true)
        expect(
            free({
                ...base,
                stepMinutes: 15,
                timeZone: "Asia/Ho_Chi_Minh",
                dailyHours: { from: "09:00", to: "17:30" },
                limit: 10,
            }),
        ).toBe(true)
        expect(free({ ...base, timeZone: "Asia/Ho_Chi_Minh", dailyHours: { from: "09:00", to: "24:00" } })).toBe(true)
    })

    it("slot.free.list refuses an inverted or over-long window, a bad length, daily hours without a zone or reversed, a made-up zone, a bare date", () => {
        expect(free({ ...base, windowEnd: base.windowStart })).toBe(false)
        expect(free({ ...base, windowEnd: "2026-04-01T00:00:00+07:00" })).toBe(false)
        expect(free({ ...base, durationMinutes: 1 })).toBe(false)
        expect(free({ ...base, durationMinutes: 1441 })).toBe(false)
        expect(free({ ...base, dailyHours: { from: "09:00", to: "17:00" } })).toBe(false)
        expect(free({ ...base, timeZone: "Asia/Ho_Chi_Minh", dailyHours: { from: "17:00", to: "09:00" } })).toBe(false)
        expect(free({ ...base, timeZone: "Mars/Olympus" })).toBe(false)
        expect(free({ ...base, windowStart: "2026-01-06" })).toBe(false)
        expect(free({ ...base, limit: 201 })).toBe(false)
        expect(free({ ...base, extra: true })).toBe(false)
    })

    it("event.create needs a title and an end after the start, and an own id in the documented alphabet", () => {
        const create = (value: unknown): boolean => CALENDAR_EVENT_CREATE_SCHEMA.safeParse(value).success
        const ok = { summary: "Fitting", start: "2026-01-06T10:00:00+07:00", end: "2026-01-06T10:30:00+07:00" }
        expect(create(ok)).toBe(true)
        expect(
            create({
                ...ok,
                eventId: "abcde12345",
                guests: ["a@example.com"],
                notifyGuests: true,
                timeZone: "Asia/Ho_Chi_Minh",
            }),
        ).toBe(true)
        expect(create({ ...ok, end: ok.start })).toBe(false)
        expect(create({ ...ok, summary: " " })).toBe(false)
        expect(create({ ...ok, eventId: "ABCDE" })).toBe(false)
        expect(create({ ...ok, eventId: "abcw1" })).toBe(false)
        expect(create({ ...ok, eventId: "abcd" })).toBe(false)
        expect(create({ ...ok, guests: ["not a mail"] })).toBe(false)
    })

    it("event.update needs something to change, and start with end", () => {
        const update = (value: unknown): boolean => CALENDAR_EVENT_UPDATE_SCHEMA.safeParse(value).success
        expect(update({ eventId: "e1", summary: "New" })).toBe(true)
        expect(update({ eventId: "e1", start: "2026-01-06T10:00:00Z", end: "2026-01-06T11:00:00Z" })).toBe(true)
        expect(update({ eventId: "e1" })).toBe(false)
        expect(update({ eventId: "e1", start: "2026-01-06T10:00:00Z" })).toBe(false)
        expect(update({ eventId: "e1", start: "2026-01-06T12:00:00Z", end: "2026-01-06T11:00:00Z" })).toBe(false)
    })

    it("event.cancel takes an event and an optional notice", () => {
        expect(CALENDAR_EVENT_CANCEL_SCHEMA.safeParse({ eventId: "e1", notifyGuests: true }).success).toBe(true)
        expect(CALENDAR_EVENT_CANCEL_SCHEMA.safeParse({}).success).toBe(false)
    })
})

describe("CalendarNativeService > slot.free.list", () => {
    it("asks the port for the busy ranges and answers exact slots told in the zone, daily hours applied", async () => {
        const { service, port } = await build()
        port.busy.mockResolvedValue({
            calendarId: "primary",
            // 10:00-10:30 local (Asia/Ho_Chi_Minh) = 03:00Z-03:30Z, and an overlapping 10:20-11:00 local.
            busy: [
                { start: "2026-01-06T03:00:00Z", end: "2026-01-06T03:30:00Z" },
                { start: "2026-01-06T03:20:00Z", end: "2026-01-06T04:00:00Z" },
            ],
        })

        const answer = await service.invoke(
            "ws-1",
            CALENDAR_TOOL_NAME.slotFreeList,
            {
                windowStart: "2026-01-06T00:00:00+07:00",
                windowEnd: "2026-01-07T00:00:00+07:00",
                durationMinutes: 60,
                timeZone: "Asia/Ho_Chi_Minh",
                dailyHours: { from: "09:00", to: "13:00" },
            },
            caller,
        )

        expect(port.busy).toHaveBeenCalledWith(account, {
            calendarId: null,
            windowStart: "2026-01-06T00:00:00+07:00",
            windowEnd: "2026-01-07T00:00:00+07:00",
            timeZone: "Asia/Ho_Chi_Minh",
        })
        expect(answer).toEqual({
            calendarId: "primary",
            timeZone: "Asia/Ho_Chi_Minh",
            slots: [
                { start: "2026-01-06T09:00:00+07:00", end: "2026-01-06T10:00:00+07:00" },
                { start: "2026-01-06T11:00:00+07:00", end: "2026-01-06T12:00:00+07:00" },
                { start: "2026-01-06T12:00:00+07:00", end: "2026-01-06T13:00:00+07:00" },
            ],
            truncated: false,
        })
    })

    it("answers in UTC when no zone is named, and says when the limit cut the list", async () => {
        const { service, port } = await build()
        port.busy.mockResolvedValue({ calendarId: "primary", busy: [] })
        const answer = await service.invoke(
            "ws-1",
            CALENDAR_TOOL_NAME.slotFreeList,
            { windowStart: "2026-01-06T00:00:00Z", windowEnd: "2026-01-06T06:00:00Z", durationMinutes: 60, limit: 2 },
            caller,
        )
        expect(answer).toEqual({
            calendarId: "primary",
            timeZone: "UTC",
            slots: [
                { start: "2026-01-06T00:00:00Z", end: "2026-01-06T01:00:00Z" },
                { start: "2026-01-06T01:00:00Z", end: "2026-01-06T02:00:00Z" },
            ],
            truncated: true,
        })
    })
})

describe("CalendarNativeService > events", () => {
    it("creates an event with the neutral request and answers the event", async () => {
        const { service, port } = await build()
        port.createEvent.mockResolvedValue(EVENT)

        const answer = await service.invoke(
            "ws-1",
            CALENDAR_TOOL_NAME.eventCreate,
            {
                summary: "Fitting",
                start: "2026-01-06T10:00:00+07:00",
                end: "2026-01-06T10:30:00+07:00",
                guests: ["a@example.com"],
                notifyGuests: true,
            },
            caller,
        )

        expect(answer).toEqual({ ...EVENT })
        expect(port.createEvent).toHaveBeenCalledWith(account, {
            calendarId: null,
            eventId: null,
            summary: "Fitting",
            description: null,
            location: null,
            start: { dateTime: "2026-01-06T10:00:00+07:00", timeZone: null },
            end: { dateTime: "2026-01-06T10:30:00+07:00", timeZone: null },
            guests: ["a@example.com"],
            notifyGuests: true,
        })
    })

    it("updates only what the call names", async () => {
        const { service, port } = await build()
        port.updateEvent.mockResolvedValue(EVENT)
        await service.invoke("ws-1", CALENDAR_TOOL_NAME.eventUpdate, { eventId: "evt1", location: "Shop 2" }, caller)
        expect(port.updateEvent).toHaveBeenCalledWith(account, {
            calendarId: null,
            eventId: "evt1",
            summary: null,
            description: null,
            location: "Shop 2",
            start: null,
            end: null,
            guests: null,
            notifyGuests: false,
        })
    })

    it("cancels an event and says when it was already gone", async () => {
        const { service, port } = await build()
        port.cancelEvent.mockResolvedValue({ calendarId: "primary", eventId: "evt1", cancelled: false })
        await expect(
            service.invoke("ws-1", CALENDAR_TOOL_NAME.eventCancel, { eventId: "evt1" }, caller),
        ).resolves.toEqual({
            calendarId: "primary",
            eventId: "evt1",
            cancelled: false,
            alreadyCancelled: true,
        })
    })
})

describe("CalendarNativeService > accounts and refusals", () => {
    const args = { eventId: "evt1" }

    it("refuses a call with no account handed, an unknown account, and an account of a provider without a calendar", async () => {
        const none = await failure(
            (await build()).service.invoke("ws-1", CALENDAR_TOOL_NAME.eventCancel, args, {
                agentId: "agent-1",
                conversationId: null,
            }),
        )
        expect(refusalOf(none)).toEqual({ reason: "not_connected", refusalClass: "infrastructure" })
        const unknown = await failure(
            (await build(null)).service.invoke("ws-1", CALENDAR_TOOL_NAME.eventCancel, args, caller),
        )
        expect(refusalOf(unknown)).toEqual({ reason: "not_connected", refusalClass: "infrastructure" })
        const other = connectionRecord({ id: "conn-1", workspaceId: "ws-1", provider: "sepay" })
        const noPort = await failure(
            (await build(other)).service.invoke("ws-1", CALENDAR_TOOL_NAME.eventCancel, args, caller),
        )
        expect(refusalOf(noPort)).toEqual({ reason: "not_connected", refusalClass: "infrastructure" })
    })

    it("answers a provider's refusals as the tool's own: business for rejected / not_found, infrastructure for a refused credential", async () => {
        const { service, port } = await build()
        for (const [reason, expected] of [
            ["rejected", { reason: "rejected", refusalClass: "business" }],
            ["not_found", { reason: "not_found", refusalClass: "business" }],
            ["auth_refused", { reason: "connection_refused", refusalClass: "infrastructure" }],
            ["no_credential", { reason: "not_connected", refusalClass: "infrastructure" }],
            ["not_available", { reason: "not_available", refusalClass: "infrastructure" }],
        ] as const) {
            port.cancelEvent.mockRejectedValue(providerRefusal("google", reason))
            expect(
                refusalOf(await failure(service.invoke("ws-1", CALENDAR_TOOL_NAME.eventCancel, args, caller))),
            ).toEqual(expected)
        }
    })

    it("lets any other failure through as it is, and refuses an unknown tool", async () => {
        const { service, port } = await build()
        const boom = new Error("boom")
        port.cancelEvent.mockRejectedValue(boom)
        expect(await failure(service.invoke("ws-1", CALENDAR_TOOL_NAME.eventCancel, args, caller))).toBe(boom)
        expect(await failure(service.invoke("ws-1", "calendar.nope", {}, caller))).toBeDefined()
    })

    it("refuses arguments outside the schema before any account is asked", async () => {
        const { service, connections } = await build()
        const error = await failure(service.invoke("ws-1", CALENDAR_TOOL_NAME.eventCreate, { summary: "x" }, caller))
        expect(error).toBeDefined()
        expect(connections.find).not.toHaveBeenCalled()
    })
})
