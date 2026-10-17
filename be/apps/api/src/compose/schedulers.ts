import type { QueueSchedulerDefinition } from "@modules/platform/queue"

/** Recurring ticks are owned by the database migrations. */
export const API_SCHEDULERS: ReadonlyArray<QueueSchedulerDefinition> = []
