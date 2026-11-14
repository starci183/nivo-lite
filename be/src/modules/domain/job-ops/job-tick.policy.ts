import { ACCOUNT_DATA_RETENTION_QUEUE } from "@modules/queues/account-data-retention"
import { AGENT_TURN_QUEUE, AgentTurnJob } from "@modules/queues/agent-turn"
import { CONNECTION_POLL_QUEUE, POLL_DUE_CONNECTIONS_JOB } from "@modules/queues/connection-poll"
import { CONNECTION_HEALTH_QUEUE } from "@modules/queues/connection-health"
import { DATA_SYNC_QUEUE } from "@modules/queues/data-sync"
import { KNOWLEDGE_QUEUE, KnowledgeJob } from "@modules/queues/knowledge"
import { REALTIME_RETENTION_QUEUE } from "@modules/queues/realtime-retention"
import { SYSTEM_HISTORY_RETENTION_QUEUE } from "@modules/queues/system-history-retention"
import { VECTOR_SYNC_QUEUE, VectorSyncJob } from "@modules/queues/vector-sync"
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

/** The operator ticks declared by the job-ticks migration and the app scheduler (`brain-upkeep`). */
export const JOB_TICKS: Readonly<Record<string, JobTick>> = {
    "account-data-retention": {
        queue: ACCOUNT_DATA_RETENTION_QUEUE,
        job: ACCOUNT_DATA_RETENTION_QUEUE,
        payload: { batch: 1000 },
        minutes: 1440,
    },
    "agent-work-sweep": { queue: AGENT_TURN_QUEUE, job: AgentTurnJob.Sweep, payload: {}, minutes: 1 },
    // The truth graph's timed upkeep (BR1, platform/jobs `brain-upkeep`): the brain command job of the knowledge queue with the literal
    // upkeep payload (domain brain `BRAIN_UPKEEP_PAYLOAD`); `maintain` is idempotent, so a manual tick beside the timed one changes nothing twice.
    "brain-upkeep": { queue: KNOWLEDGE_QUEUE, job: KnowledgeJob.BrainCommand, payload: { upkeep: "brain" }, minutes: 5 },
    "connection-health-tick": {
        queue: CONNECTION_HEALTH_QUEUE,
        job: CONNECTION_HEALTH_QUEUE,
        payload: { silentAfterHours: 72 },
        minutes: 15,
    },
    "connection-poll-due-tick": {
        queue: CONNECTION_POLL_QUEUE,
        job: POLL_DUE_CONNECTIONS_JOB,
        payload: {},
        minutes: 1,
    },
    "data-sync-tick": { queue: DATA_SYNC_QUEUE, job: DATA_SYNC_QUEUE, payload: { tick: true }, minutes: 1 },
    "realtime-retention-tick": {
        queue: REALTIME_RETENTION_QUEUE,
        job: REALTIME_RETENTION_QUEUE,
        payload: { tick: true },
        minutes: 1,
    },
    "system-history-retention": {
        queue: SYSTEM_HISTORY_RETENTION_QUEUE,
        job: SYSTEM_HISTORY_RETENTION_QUEUE,
        payload: { doneDays: 1, failedDays: 7, batch: 5000 },
        minutes: 1440,
    },
    // The reconcile of the vector index against Postgres (platform/jobs `vector-reconcile`): idempotent, so a manual tick only runs it sooner.
    "vector-reconcile": { queue: VECTOR_SYNC_QUEUE, job: VectorSyncJob.Reconcile, payload: {}, minutes: 5 },
    "zalo-refresh-tick": {
        queue: ZALO_REFRESH_QUEUE,
        job: ZALO_REFRESH_QUEUE,
        payload: { withinMs: 25_200_000 },
        minutes: 360,
    },
}
