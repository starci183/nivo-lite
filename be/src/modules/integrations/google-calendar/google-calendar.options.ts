/** Options of the Google Calendar integration: tunables only (the access token is per call). */
export interface GoogleCalendarOptions {
    /** The Calendar API origin, without a trailing slash (`https://www.googleapis.com`; a test fake overrides it). */
    readonly apiBase: string
    /** How long one call waits. */
    readonly timeoutMs: number
}
