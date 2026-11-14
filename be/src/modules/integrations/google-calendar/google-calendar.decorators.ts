import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { GoogleCalendarClient } from "./google-calendar.client"
import type { GoogleCalendarOptions } from "./google-calendar.options"

/** Token of the Google Calendar client. */
export const GOOGLE_CALENDAR: unique symbol = Symbol("integrations.google-calendar")

/** Token of the options of the Google Calendar integration, exported so a spec can provide it. */
export const GOOGLE_CALENDAR_OPTIONS: unique symbol = Symbol("integrations.google-calendar.options")

/** Injects the options of the Google Calendar integration. Parameter type: GoogleCalendarOptions. */
export const InjectGoogleCalendarOptions = (): TypedParameterDecorator<GoogleCalendarOptions> =>
    injector<GoogleCalendarOptions>(GOOGLE_CALENDAR_OPTIONS)

/** Injects the Google Calendar client. Parameter type: GoogleCalendarClient. */
export const InjectGoogleCalendar = (): TypedParameterDecorator<GoogleCalendarClient> => injector<GoogleCalendarClient>(GOOGLE_CALENDAR)
