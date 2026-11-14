import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { ProviderOperation } from "@modules/integrations/provider-http"

/** The provider segment of the Google Calendar level-1 names (Calendar is served by the `google` account). */
const SEGMENT = "nivo.api.google.calendar"

/** The reference of the Calendar API v3 every operation is cited from. */
const DOCS = "https://developers.google.com/workspace/calendar/api/v3/reference"

/**
 * Every Google Calendar API v3 operation NIVO calls (auth: `Authorization: Bearer <access token>`). `serves` carries the generic tool ids
 * as `TOOL` constants.
 */
export const GOOGLE_CALENDAR_OPERATIONS: Readonly<
    Record<"freebusyQuery" | "eventsList" | "eventsInsert" | "eventsPatch" | "eventsDelete", ProviderOperation>
> = {
    freebusyQuery: {
        api: `${SEGMENT}.freebusy.query`,
        method: "POST",
        path: "/calendar/v3/freeBusy",
        docs: `${DOCS}/freebusy/query`,
        status: "built",
        serves: TOOL.calendarSlotFreeList,
    },
    eventsList: {
        api: `${SEGMENT}.events.list`,
        method: "GET",
        path: "/calendar/v3/calendars/{calendarId}/events",
        docs: `${DOCS}/events/list`,
        status: "built",
        serves: null,
    },
    eventsInsert: {
        api: `${SEGMENT}.events.insert`,
        method: "POST",
        path: "/calendar/v3/calendars/{calendarId}/events",
        docs: `${DOCS}/events/insert`,
        status: "built",
        serves: TOOL.calendarEventCreate,
    },
    eventsPatch: {
        api: `${SEGMENT}.events.patch`,
        method: "PATCH",
        path: "/calendar/v3/calendars/{calendarId}/events/{eventId}",
        docs: `${DOCS}/events/patch`,
        status: "built",
        serves: TOOL.calendarEventUpdate,
    },
    eventsDelete: {
        api: `${SEGMENT}.events.delete`,
        method: "DELETE",
        path: "/calendar/v3/calendars/{calendarId}/events/{eventId}",
        docs: `${DOCS}/events/delete`,
        status: "built",
        serves: TOOL.calendarEventCancel,
    },
}
