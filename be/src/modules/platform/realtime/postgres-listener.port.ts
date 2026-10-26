/** What a LISTEN connection tells the hub: the payload of a notification (absent for an empty NOTIFY). */
export interface ListenMessage {
    /** The text the NOTIFY carried; absent for a NOTIFY with no payload. */
    readonly payload?: string | undefined
}

/** The slice of a `pg` client the hub listens through; the `pg` client satisfies it as it is. */
export interface ListenConnection {
    /** A notification arrived on a channel this connection listens on. */
    on(event: "notification", listener: (message: ListenMessage) => void): unknown
    /** The connection failed. */
    on(event: "error", listener: (cause: Error) => void): unknown
    /** The connection closed. */
    on(event: "end", listener: () => void): unknown
    /** Opens the connection. */
    connect(): Promise<unknown>
    /** Runs one statement (the LISTEN). */
    query(text: string): Promise<unknown>
    /** Closes the connection. */
    end(): Promise<void>
}

/** Opens one `pg` connection to the session-mode URL; the only place the driver is constructed. */
export interface ListenFactory {
    /** A new, not yet connected connection. */
    create(url: string): ListenConnection
}

/** What the hub does with the notifications of one LISTEN connection. */
export interface ListenHandlers {
    /** Called with the payload of every notification, in the order Postgres delivered them. */
    readonly notify: (payload: string) => void
    /** Sends the payload as a notification on the hub channel from ANOTHER session: the proof that a new connection hears what others publish. */
    readonly probe: (payload: string) => Promise<void>
    /** Called when the connection was lost: notifications are not delivered until the connection is open again. */
    readonly lost: () => void
    /** Called after the connection was lost and opened again: notifications sent in between were not delivered. */
    readonly resumed: () => void
}

/** A LISTEN connection that keeps itself open: the hub gets every notification of its channel while the process lives. */
export interface NotificationListener {
    /** Opens the connection and starts listening; a first connection that cannot open fails the boot. */
    start(handlers: ListenHandlers): Promise<void>
    /** Stops reconnecting and closes the connection. */
    stop(): Promise<void>
}
