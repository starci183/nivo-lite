/** The first event a connection accepted. */
export class FirstEventBody {
    /** The amount of the event. */
    amount!: number
    /** The content of the event. */
    content!: string
    /** When it arrived, ISO 8601. */
    at!: string
    /** An optional readable line. */
    text?: string
}

/** The HTTP response of the first-event check. */
export class FirstEventResponse {
    /** The connection status. */
    status!: string
    /** The first event, once there is one. */
    firstEvent!: FirstEventBody | null
}
