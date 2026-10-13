/** Which owner channels received a video link. */
export interface VideoShareResult {
    /** Written to Office. */
    readonly office: boolean
    /** Delivered to an owner Telegram chat. */
    readonly telegram: boolean
}
