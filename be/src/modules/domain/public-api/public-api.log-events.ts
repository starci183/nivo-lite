/** Log events of the public-api capability. */
export enum PublicApiLogEvent {
    /** An admitted message past its auto-send window was held for approval instead of going out on its own. */
    StaleMessageHeld = "public_api.message.stale_held",
    /** The report of a held message could not reach the founder on /chat (no team chat, or it refused); the hold itself stands. */
    HeldReportSkipped = "public_api.message.held_report_skipped",
}
