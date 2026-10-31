import { ACCOUNTING_DESK_QUEUE, ACCOUNTING_MORNING_JOB } from "@modules/queues/accounting-desk"
import { AGENT_TURN_QUEUE, AgentTurnJob } from "@modules/queues/agent-turn"
import { AGENTS_QUEUE, AgentsJob } from "@modules/queues/agents"
import { AUTOMATION_QUEUE, AUTOMATION_TICK_JOB } from "@modules/queues/automation"
import { CONNECTION_HEALTH_QUEUE } from "@modules/queues/connection-health"
import { CONTENT_TICK_QUEUE } from "@modules/queues/content-tick"
import { DATA_SYNC_QUEUE } from "@modules/queues/data-sync"
import { DECISIONS_QUEUE, DecisionsJob } from "@modules/queues/decisions"
import { MARKETING_TICK_QUEUE } from "@modules/queues/marketing-tick"
import { REALTIME_RETENTION_QUEUE } from "@modules/queues/realtime-retention"
import { SYSTEM_HISTORY_RETENTION_QUEUE } from "@modules/queues/system-history-retention"
import { SHIFTS_QUEUE, SHIFTS_TICK_JOB } from "@modules/queues/shifts"
import { ZALO_REFRESH_QUEUE } from "@modules/queues/zalo-refresh"

/** A manually triggered migration-owned tick and its idempotency window. */
export interface JobTick {
    /** The destination queue. */
    readonly queue: string
    /** The message name, identical to the migration. */
    readonly job: string
    /** The message payload, identical to the migration. */
    readonly payload: object
    /** The cadence in minutes; repeated operator requests in this window enqueue once. */
    readonly minutes: number
}

/** The operator ticks declared by the job-ticks migration and the accounting desk migration. */
export const JOB_TICKS: Readonly<Record<string, JobTick>> = {
    "accounting-desk-morning": {
        queue: ACCOUNTING_DESK_QUEUE,
        job: ACCOUNTING_MORNING_JOB,
        payload: {},
        minutes: 1440,
    },
    "agent-work-sweep": { queue: AGENT_TURN_QUEUE, job: AgentTurnJob.Sweep, payload: {}, minutes: 1 },
    "agents-sync-all": { queue: AGENTS_QUEUE, job: AgentsJob.Sync, payload: {}, minutes: 5 },
    "automation-tick": { queue: AUTOMATION_QUEUE, job: AUTOMATION_TICK_JOB, payload: {}, minutes: 1 },
    "connection-health-tick": {
        queue: CONNECTION_HEALTH_QUEUE,
        job: CONNECTION_HEALTH_QUEUE,
        payload: { silentAfterHours: 72 },
        minutes: 15,
    },
    "content-tick": { queue: CONTENT_TICK_QUEUE, job: CONTENT_TICK_QUEUE, payload: {}, minutes: 15 },
    "data-sync-tick": { queue: DATA_SYNC_QUEUE, job: DATA_SYNC_QUEUE, payload: { tick: true }, minutes: 1 },
    "decisions-drain-work": { queue: DECISIONS_QUEUE, job: DecisionsJob.DrainWork, payload: {}, minutes: 1 },
    "marketing-tick": { queue: MARKETING_TICK_QUEUE, job: MARKETING_TICK_QUEUE, payload: {}, minutes: 15 },
    "realtime-retention-tick": {
        queue: REALTIME_RETENTION_QUEUE,
        job: REALTIME_RETENTION_QUEUE,
        payload: { tick: true },
        minutes: 1,
    },
    "shifts-tick": { queue: SHIFTS_QUEUE, job: SHIFTS_TICK_JOB, payload: { kind: "tick" }, minutes: 1 },
    "system-history-retention": {
        queue: SYSTEM_HISTORY_RETENTION_QUEUE,
        job: SYSTEM_HISTORY_RETENTION_QUEUE,
        payload: { doneDays: 1, failedDays: 7, batch: 5000 },
        minutes: 1440,
    },
    "zalo-refresh-tick": {
        queue: ZALO_REFRESH_QUEUE,
        job: ZALO_REFRESH_QUEUE,
        payload: { withinMs: 25_200_000 },
        minutes: 360,
    },
}
