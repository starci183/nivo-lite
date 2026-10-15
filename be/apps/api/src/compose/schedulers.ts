import { AGENTS_SYNC_SCHEDULER } from "@modules/queues/agents"
import { AUTOMATION_TICK_SCHEDULER } from "@modules/queues/automation"
import { SHIFTS_TICK_SCHEDULER } from "@modules/queues/shifts"
import { DECISIONS_DRAIN_SCHEDULER } from "@modules/queues/decisions"
import { CONNECTION_HEALTH_SCHEDULER } from "@modules/queues/connection-health"
import { CONTENT_TICK_EVERY_MS, CONTENT_TICK_QUEUE, CONTENT_TICK_SCHEDULER } from "@modules/queues/content-tick"
import { DATA_SYNC_SCHEDULER } from "@modules/queues/data-sync"
import { ZALO_REFRESH_SCHEDULER } from "@modules/queues/zalo-refresh"
import type { QueueSchedulerDefinition } from "@modules/platform/queue"

/** The recurring ticks the api schedules on the queue. */
export const API_SCHEDULERS: ReadonlyArray<QueueSchedulerDefinition> = [
    AUTOMATION_TICK_SCHEDULER,
    SHIFTS_TICK_SCHEDULER,
    AGENTS_SYNC_SCHEDULER,
    DECISIONS_DRAIN_SCHEDULER,
    { queue: CONTENT_TICK_QUEUE, id: CONTENT_TICK_SCHEDULER, everyMs: CONTENT_TICK_EVERY_MS },
    CONNECTION_HEALTH_SCHEDULER,
    ZALO_REFRESH_SCHEDULER,
    DATA_SYNC_SCHEDULER,
]
