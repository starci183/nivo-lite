import type { EnvSource } from "@modules/platform/config"
import type { GoogleCalendarOptions } from "./google-calendar.options"

/** The origin of the reference pages' addresses (https://developers.google.com/workspace/calendar/api/v3/reference: `https://www.googleapis.com/calendar/v3/...`). */
const DEFAULT_API_BASE = "https://www.googleapis.com"

/** Reads the Google Calendar options: only tunables live in the environment. */
export const parseGoogleCalendarConfig = (env: EnvSource): GoogleCalendarOptions => ({
    apiBase: (env.optional("GOOGLE_CALENDAR_API_BASE") ?? DEFAULT_API_BASE).replace(/\/$/u, ""),
    timeoutMs: env.duration("GOOGLE_CALENDAR_API_TIMEOUT", 30_000),
})
