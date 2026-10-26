/** One server-authored message on a private Supabase Realtime broadcast channel. */
export interface PrivateBroadcast {
    /** The authorized channel name, without Supabase's internal prefix. */
    readonly topic: string
    /** The application event name clients subscribe to. */
    readonly event: string
    /** The JSON object delivered as the broadcast payload. */
    readonly payload: Readonly<Record<string, unknown>>
}
