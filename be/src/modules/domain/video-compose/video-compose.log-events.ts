/** Log events of the compose purpose's render door: ids and counts only, never a body, an address or a secret. */
export enum VideoComposeLogEvent {
    /** A render webhook was taken: the provider, the account, what it came to (kept, repeat, ignored, unreadable, unknown account). */
    RenderReceived = "video_compose.render_received",
    /** A proven render webhook's body was no JSON: the provider and the parser's words, never the body. */
    RenderUnreadable = "video_compose.render_unreadable",
    /** Firing `render.completed` for a kept render row failed; the row stays pending and the run's wait falls back on its timeout. */
    RenderFireFailed = "video_compose.render_fire_failed",
}
