/** Log events of the public-api capability. */
export enum PublicApiLogEvent {
    /** An admitted message past its auto-send window was held for approval instead of going out on its own. */
    StaleMessageHeld = "public_api.message.stale_held",
}
