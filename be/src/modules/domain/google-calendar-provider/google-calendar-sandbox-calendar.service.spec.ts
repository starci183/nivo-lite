import { readFileSync } from "node:fs"
import type { CalendarEventRequest } from "@modules/domain/provider-registry"
import { proofOf, providerRefusalDetail, providerRefusalReason } from "@modules/domain/provider-registry"
import { ProviderSandboxError, ProviderSandboxErrorCode } from "@modules/domain/provider-sandbox"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { sandboxAccount, sandboxServiceOf, sandboxServiceOff } from "@tests/fixtures/builders/provider-sandbox.builder"
import { GCAL_SANDBOX_CATALOGUE, GCAL_SANDBOX_EVENTS } from "./google-calendar-sandbox.catalogue"
import { GoogleCalendarSandboxService } from "./google-calendar-sandbox-calendar.service"

const build = () => {
    const account = sandboxAccount({ provider: "google" })
    const { sandbox } = sandboxServiceOf(account)
    const connection = connectionRecord({ provider: "google", id: account.id, workspaceId: account.workspaceId, sandbox: true })
    return { account, sandbox, connection, calendar: new GoogleCalendarSandboxService(sandbox) }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const WEEK = { windowStart: "2026-11-16T00:00:00+07:00", windowEnd: "2026-11-23T00:00:00+07:00", timeZone: null }
const query = (calendarId: string | null = null) => ({ calendarId, ...WEEK })
const made = (overrides: Partial<CalendarEventRequest> = {}): CalendarEventRequest => ({
    calendarId: null,
    eventId: null,
    summary: "Hẹn tư vấn",
    description: null,
    location: null,
    start: { dateTime: "2026-11-18T14:00:00+07:00", timeZone: null },
    end: { dateTime: "2026-11-18T15:00:00+07:00", timeZone: null },
    guests: null,
    notifyGuests: false,
    ...overrides,
})

describe("GoogleCalendarSandboxService", () => {
    it("answers the five fixed events of the week as busy, and only those overlapping a narrower window (GCAL-1)", async () => {
        const { calendar, connection } = build()

        const week = await calendar.busy(connection, query())
        expect(week.calendarId).toBe("primary")
        expect(week.busy).toEqual(GCAL_SANDBOX_EVENTS.map((one) => ({ start: one.start, end: one.end })))
        await expect(calendar.busy(connection, { calendarId: null, windowStart: "2026-11-17T00:00:00+07:00", windowEnd: "2026-11-18T00:00:00+07:00", timeZone: null })).resolves.toMatchObject({
            busy: [{ start: "2026-11-17T14:00:00+07:00", end: "2026-11-17T15:30:00+07:00" }],
        })
    })

    it("answers an empty calendar as free (GCAL-2)", async () => {
        const { calendar, connection } = build()

        await expect(calendar.busy(connection, query("calendar-trong"))).resolves.toEqual({ calendarId: "calendar-trong", busy: [] })
    })

    it("makes an event into state with a running id, then it is busy until cancelled (GCAL-3)", async () => {
        const { calendar, connection } = build()

        const event = await calendar.createEvent(connection, made())
        expect(event).toEqual({
            calendarId: "primary",
            eventId: "sbev000001",
            status: "confirmed",
            link: "https://calendar.sandbox.test/event?eid=sbev000001",
            summary: "Hẹn tư vấn",
            start: "2026-11-18T14:00:00+07:00",
            end: "2026-11-18T15:00:00+07:00",
        })
        expect((await calendar.busy(connection, query())).busy).toContainEqual({ start: "2026-11-18T14:00:00+07:00", end: "2026-11-18T15:00:00+07:00" })
        await calendar.cancelEvent(connection, { calendarId: null, eventId: "sbev000001", notifyGuests: false })
        expect((await calendar.busy(connection, query())).busy).toHaveLength(5)
        await expect(calendar.createEvent(connection, made({ eventId: "own-id-1" }))).resolves.toMatchObject({ eventId: "own-id-1" })
    })

    it("refuses an event id that already exists as rejected duplicate, not_sent, and does not refuse overlapping times (GCAL-4)", async () => {
        const { calendar, connection } = build()

        const fixed = await failure(calendar.createEvent(connection, made({ eventId: "sbx-evt-giao-ban" })))
        expect(providerRefusalReason(fixed)).toBe("rejected")
        expect(providerRefusalDetail(fixed)).toBe("The requested identifier already exists.")
        expect(proofOf(fixed)).toBe("not_sent")
        await calendar.createEvent(connection, made({ eventId: "mine", start: { dateTime: "2026-11-16T09:00:00+07:00", timeZone: null } }))
        expect(providerRefusalReason(await failure(calendar.createEvent(connection, made({ eventId: "mine" }))))).toBe("rejected")
    })

    it("changes only what is set, on a fixed event and on a made one; an unknown or cancelled event is not found (GCAL-5)", async () => {
        const { calendar, connection } = build()
        const change = { calendarId: null, eventId: "sbx-evt-giao-ban", summary: "Họp giao ban (dời)", description: null, location: null, start: { dateTime: "2026-11-16T11:00:00+07:00", timeZone: null }, end: null, guests: null, notifyGuests: false }

        await expect(calendar.updateEvent(connection, change)).resolves.toMatchObject({ eventId: "sbx-evt-giao-ban", summary: "Họp giao ban (dời)", start: "2026-11-16T11:00:00+07:00", end: "2026-11-16T10:00:00+07:00" })
        expect(providerRefusalReason(await failure(calendar.updateEvent(connection, { ...change, eventId: "nope" })))).toBe("not_found")
        await calendar.cancelEvent(connection, { calendarId: null, eventId: "sbx-evt-giao-ban", notifyGuests: false })
        expect(providerRefusalReason(await failure(calendar.updateEvent(connection, change)))).toBe("not_found")
    })

    it("cancels once, answers cancelled false the second time, and not found for an unknown event (GCAL-6)", async () => {
        const { calendar, connection } = build()
        const cancel = (eventId: string) => calendar.cancelEvent(connection, { calendarId: null, eventId, notifyGuests: true })

        await expect(cancel("sbx-evt-khach-hang")).resolves.toEqual({ calendarId: "primary", eventId: "sbx-evt-khach-hang", cancelled: true })
        await expect(cancel("sbx-evt-khach-hang")).resolves.toMatchObject({ cancelled: false })
        const error = await failure(cancel("nope"))
        expect(providerRefusalReason(error)).toBe("not_found")
        expect(proofOf(error)).toBe("not_sent")
        expect((await calendar.busy(connection, query())).busy).toHaveLength(4)
    })

    it("refuses every operation on the expired and the missing calendar (GCAL-7, GCAL-8)", async () => {
        const { calendar, connection } = build()

        for (const [id, reason] of [
            ["calendar-het-han", "auth_refused"],
            ["calendar-khong-co", "not_found"],
        ] as const) {
            for (const work of [
                calendar.busy(connection, query(id)),
                calendar.createEvent(connection, made({ calendarId: id })),
                calendar.updateEvent(connection, { calendarId: id, eventId: "x", summary: null, description: null, location: null, start: null, end: null, guests: null, notifyGuests: false }),
                calendar.cancelEvent(connection, { calendarId: id, eventId: "x", notifyGuests: false }),
            ]) {
                const error = await failure(work)
                expect(providerRefusalReason(error)).toBe(reason)
                expect(proofOf(error)).toBe("not_sent")
            }
        }
    })

    it("takes one logged call per request with the live operation names", async () => {
        const { calendar, connection, sandbox, account } = build()

        await calendar.busy(connection, query())
        await calendar.createEvent(connection, made())
        await calendar.updateEvent(connection, { calendarId: null, eventId: "sbev000001", summary: "x", description: null, location: null, start: null, end: null, guests: null, notifyGuests: false })
        await calendar.cancelEvent(connection, { calendarId: null, eventId: "sbev000001", notifyGuests: false })

        expect((await sandbox.calls(account)).map((call) => [call.operation, call.key])).toEqual([
            ["busy", "primary"],
            ["createEvent", ""],
            ["updateEvent", "sbev000001"],
            ["cancelEvent", "sbev000001"],
        ])
    })

    it("is deterministic: two fresh accounts answer the same", async () => {
        const one = build()
        const two = build()

        expect(await one.calendar.busy(one.connection, query())).toEqual(await two.calendar.busy(two.connection, query()))
        expect(await one.calendar.createEvent(one.connection, made())).toEqual(await two.calendar.createEvent(two.connection, made()))
    })

    it("refuses a live account and a switched-off sandbox", async () => {
        const { calendar } = build()
        const live = await failure(calendar.busy(connectionRecord({ provider: "google", id: "live-1" }), query()))
        expect(live).toBeInstanceOf(ProviderSandboxError)
        expect((live as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.LiveAccount)

        const account = sandboxAccount({ provider: "google" })
        const off = new GoogleCalendarSandboxService(sandboxServiceOff(account).sandbox)
        const refused = await failure(off.busy(connectionRecord({ provider: "google", id: account.id, sandbox: true }), query()))
        expect((refused as ProviderSandboxError).code).toBe(ProviderSandboxErrorCode.Off)
    })

    it("has a catalogue of unique GCAL-<n> ids, and no inbound case (the calendar is read and written, never calling back)", () => {
        const ids = GCAL_SANDBOX_CATALOGUE.cases.map((one) => one.id)
        expect(new Set(ids).size).toBe(ids.length)
        expect(ids.every((id) => /^GCAL-\d+$/.test(id))).toBe(true)
        expect(GCAL_SANDBOX_CATALOGUE.provider).toBe("google")
        expect(GCAL_SANDBOX_CATALOGUE.cases.every((one) => one.inbound === undefined)).toBe(true)
    })

    it("reaches no host: one constructor parameter and no integration or network word in its source", () => {
        expect(GoogleCalendarSandboxService.length).toBe(1)
        const source = readFileSync(__filename.replace(".spec.ts", ".ts"), "utf8")
        expect(source).not.toContain("@modules/integrations")
        expect(source).not.toContain("http")
    })
})
