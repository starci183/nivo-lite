import type { QueueSchedulerDefinition } from "@modules/platform/queue"

/** The queue name: the contract between the scheduler below and the processor of the check-connection-health job (a pgmq queue name). */
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

const SILENT_AFTER_HOURS = 72
const CHECK_EVERY_MS = 15 * 60_000

/** The check runs every 15 minutes; pg_cron upserts it by id, so every replica may register it and it still fires once per interval. */
export const CONNECTION_HEALTH_SCHEDULER: QueueSchedulerDefinition = {
    ...{ queue: CONNECTION_HEALTH_QUEUE, id: "connection-health-tick", everyMs: CHECK_EVERY_MS },
    payload: { silentAfterHours: SILENT_AFTER_HOURS } satisfies ConnectionHealthPayload,
}
