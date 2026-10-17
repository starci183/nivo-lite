/** The queue name: the contract between the migration tick and the processor of the check-connection-health job (a pgmq queue name). */
export const CONNECTION_HEALTH_QUEUE = "connection_health"

/** The payload of one tick: how long a receiving connection may stay silent before it is marked. */
export interface ConnectionHealthPayload {
    /** Hours without an event after which a receiving connection is silent. */
    readonly silentAfterHours: number
}

/** True when a job payload is the payload of a connection-health tick. */
export const isConnectionHealthPayload = (value: unknown): value is ConnectionHealthPayload =>
    typeof value === "object" &&
    value !== null &&
    "silentAfterHours" in value &&
    typeof value.silentAfterHours === "number"
