import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, Provider } from "@modules/domain/connections"
import type { GoogleTokensService } from "@modules/domain/google-connections"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import { GoogleCalendarError, GoogleCalendarErrorCode } from "@modules/integrations/google-calendar"
import type { GoogleCalendarClient } from "@modules/integrations/google-calendar"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { GoogleCalendarCredentialService } from "./google-calendar-credential.service"
import { GoogleCalendarService } from "./google-calendar.service"

const TOKEN = ["access", "token"].join("-")
const account = (meta: Record<string, string> = { calendar: "granted" }, provider: Provider = "google"): ConnectionRecord =>
    connectionRecord({ id: "conn-g", workspaceId: "ws-1", provider, name: "Google", meta })

const EVENT = {
    id: "evt1",
    status: "confirmed",
    htmlLink: "https://www.google.com/calendar/event?eid=x",
    summary: "Fitting",
    start: "2026-01-06T10:00:00+07:00",
    end: "2026-01-06T10:30:00+07:00",
}

const build = () => {
    const tokens = mock<GoogleTokensService>()
    tokens.accessToken.mockResolvedValue(TOKEN)
    tokens.withRetry.mockImplementation(async (token, work) => work(await token(false)))
    const client = mock<GoogleCalendarClient>()
    return { service: new GoogleCalendarService(client, new GoogleCalendarCredentialService(tokens)), client, tokens }
}

describe("GoogleCalendarService > the calendar port", () => {
    it("answers the busy ranges of the primary calendar when none is named", async () => {
        const { service, client } = build()
        client.freeBusy.mockResolvedValue({ busy: [{ start: "2026-01-06T03:00:00Z", end: "2026-01-06T04:00:00Z" }] })

        const answer = await service.busy(account(), {
            calendarId: null,
            windowStart: "2026-01-06T09:00:00+07:00",
            windowEnd: "2026-01-06T17:00:00+07:00",
            timeZone: null,
        })

        expect(answer).toEqual({ calendarId: "primary", busy: [{ start: "2026-01-06T03:00:00Z", end: "2026-01-06T04:00:00Z" }] })
        expect(client.freeBusy).toHaveBeenCalledWith(TOKEN, {
            calendarId: "primary",
            timeMin: "2026-01-06T09:00:00+07:00",
            timeMax: "2026-01-06T17:00:00+07:00",
            timeZone: null,
        })
    })

    it("creates an event notifying the guests as asked and answers the neutral event", async () => {
        const { service, client } = build()
        client.insertEvent.mockResolvedValue(EVENT)

        const event = await service.createEvent(account(), {
            calendarId: "shop@example.com",
            eventId: null,
            summary: "Fitting",
            description: null,
            location: null,
            start: { dateTime: "2026-01-06T10:00:00+07:00", timeZone: null },
            end: { dateTime: "2026-01-06T10:30:00+07:00", timeZone: null },
            guests: ["a@example.com"],
            notifyGuests: true,
        })

        expect(event).toEqual({
            calendarId: "shop@example.com",
            eventId: "evt1",
            status: "confirmed",
            link: "https://www.google.com/calendar/event?eid=x",
            summary: "Fitting",
            start: "2026-01-06T10:00:00+07:00",
            end: "2026-01-06T10:30:00+07:00",
        })
        expect(client.insertEvent).toHaveBeenCalledWith(
            TOKEN,
            expect.objectContaining({ attendees: [{ email: "a@example.com" }], sendUpdates: "all", calendarId: "shop@example.com" }),
        )
    })

    it("updates only what is set and does not notify when not asked", async () => {
        const { service, client } = build()
        client.patchEvent.mockResolvedValue(EVENT)

        await service.updateEvent(account(), {
            calendarId: null,
            eventId: "evt1",
            summary: null,
            description: "new",
            location: null,
            start: null,
            end: null,
            guests: null,
            notifyGuests: false,
        })

        expect(client.patchEvent).toHaveBeenCalledWith(TOKEN, {
            calendarId: "primary",
            eventId: "evt1",
            summary: null,
            description: "new",
            location: null,
            start: null,
            end: null,
            attendees: null,
            sendUpdates: "none",
        })
    })

    it("cancels an event and says whether it was still there", async () => {
        const { service, client } = build()
        client.deleteEvent.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

        await expect(service.cancelEvent(account(), { calendarId: null, eventId: "evt1", notifyGuests: true })).resolves.toEqual({
            calendarId: "primary",
            eventId: "evt1",
            cancelled: true,
        })
        await expect(service.cancelEvent(account(), { calendarId: null, eventId: "evt1", notifyGuests: true })).resolves.toMatchObject({
            cancelled: false,
        })
        expect(client.deleteEvent).toHaveBeenCalledWith(TOKEN, { calendarId: "primary", eventId: "evt1", sendUpdates: "all" })
    })
})

describe("GoogleCalendarService > failures and what they prove", () => {
    it("sends nothing for an account that did not consent to Calendar or is no Google account (no_credential, not_sent)", async () => {
        const { service, client } = build()
        const query = { calendarId: null, windowStart: "2026-01-06T09:00:00Z", windowEnd: "2026-01-06T10:00:00Z", timeZone: null }
        for (const connection of [account({}), account({ calendar: "granted" }, "sepay")]) {
            const failure = await service.busy(connection, query).catch((cause: unknown) => cause)
            expect(failure).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
            expect(proofOf(failure)).toBe("not_sent")
        }
        expect(client.freeBusy).not.toHaveBeenCalled()
    })

    it("retries once with a fresh token when Calendar refused the first one (401)", async () => {
        const { service, client, tokens } = build()
        tokens.withRetry.mockImplementation(async (token, work, rejected) => {
            try {
                return await work(await token(false))
            } catch (cause) {
                if (!rejected(cause)) throw cause
                return work(await token(true))
            }
        })
        client.insertEvent
            .mockRejectedValueOnce(new GoogleCalendarError({ code: GoogleCalendarErrorCode.AuthFailed, params: { status: 401, reason: "authError", detail: "" } }))
            .mockResolvedValueOnce(EVENT)

        await service.createEvent(account(), {
            calendarId: null,
            eventId: null,
            summary: "x",
            description: null,
            location: null,
            start: { dateTime: "2026-01-06T10:00:00Z", timeZone: null },
            end: { dateTime: "2026-01-06T11:00:00Z", timeZone: null },
            guests: null,
            notifyGuests: false,
        })

        expect(tokens.accessToken).toHaveBeenNthCalledWith(1, { row: expect.anything(), force: false })
        expect(tokens.accessToken).toHaveBeenNthCalledWith(2, { row: expect.anything(), force: true })
        expect(client.insertEvent).toHaveBeenCalledTimes(2)
    })

    const failWith = (code: GoogleCalendarErrorCode, status: number) => {
        const { service, client } = build()
        client.deleteEvent.mockRejectedValue(new GoogleCalendarError({ code, params: { status, reason: "", detail: "words" } }))
        return Promise.resolve(service.cancelEvent(account(), { calendarId: null, eventId: "e", notifyGuests: false }).catch((cause: unknown) => cause))
    }

    it("maps a refused request, a missing event and a refused credential to refusals proving no effect", async () => {
        const rejected = await failWith(GoogleCalendarErrorCode.Rejected, 409)
        expect(rejected).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected, params: { detail: "words" } })
        expect(proofOf(rejected)).toBe("not_sent")
        expect(await failWith(GoogleCalendarErrorCode.NotFound, 404)).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNotFound })
        expect(await failWith(GoogleCalendarErrorCode.AuthFailed, 403)).toMatchObject({ code: ProviderRegistryErrorCode.RefusedAuth })
    })

    it("rethrows a rate limit as it is (no effect) and marks transport failures, 5xx and unreadable answers unknown", async () => {
        const limited = await failWith(GoogleCalendarErrorCode.RateLimited, 429)
        expect(limited).toBeInstanceOf(GoogleCalendarError)
        expect(proofOf(limited)).toBe("not_sent")
        for (const code of [GoogleCalendarErrorCode.Unreachable, GoogleCalendarErrorCode.Failed, GoogleCalendarErrorCode.Malformed]) {
            expect(proofOf(await failWith(code, 500))).toBe("unknown")
        }
    })
})
