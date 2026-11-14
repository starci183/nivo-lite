import { PARKED_JOBS_SWEEP } from "./jobs.contracts"

/** One recurring tick of platform/jobs: at each minute its cron expression names, one job of `queue` is enqueued with `payload` (R335). */
export interface JobTick {
    /** The stable name: the advisory lock key, the minute claim and the correlation id carry it. */
    readonly name: string
    /** The five-field cron expression of the minutes the tick fires at. */
    readonly cron: string
    /** The time zone the expression is read in; ticks run in UTC. */
    readonly timeZone: "UTC"
    /** The queue the tick enqueues one job of. */
    readonly queue: string
    /** The job name inside the queue; nivo-lite routes processors by queue and job, so the tick names it. */
    readonly job: string
    /** The payload of that job: ids and literals only. */
    readonly payload: object
}

/** The ticks of this app, as data: JobTickService registers one cron job per entry. */
export const JOB_TICKS: ReadonlyArray<JobTick> = [
    {
        name: "connection-health-tick",
        cron: "*/15 * * * *",
        timeZone: "UTC",
        queue: "connection_health",
        job: "connection_health",
        payload: { silentAfterHours: 72 },
    },
    {
        name: "data-sync-tick",
        cron: "*/1 * * * *",
        timeZone: "UTC",
        queue: "data_sync",
        job: "data_sync",
        payload: { tick: true },
    },
    {
        name: "agent-graph-watch",
        cron: "*/15 * * * *",
        timeZone: "UTC",
        queue: "decisions",
        job: "decisions.agent-graph-watch",
        payload: {},
    },
    {
        name: "zalo-refresh-tick",
        cron: "0 */6 * * *",
        timeZone: "UTC",
        queue: "zalo_refresh",
        job: "zalo_refresh",
        payload: { withinMs: 25200000 },
    },
    {
        name: "connection-poll-due-tick",
        cron: "*/1 * * * *",
        timeZone: "UTC",
        queue: "connection-poll",
        job: "poll-due-connections",
        payload: {},
    },
    {
        name: "realtime-retention-tick",
        cron: "* * * * *",
        timeZone: "UTC",
        queue: "realtime_retention",
        job: "realtime_retention",
        payload: { tick: true },
    },
    {
        name: "agent-work-sweep",
        cron: "*/1 * * * *",
        timeZone: "UTC",
        queue: "agent_turn",
        job: "agent-turn.sweep",
        payload: {},
    },
    {
        name: "parked-jobs-sweep",
        cron: "*/15 * * * *",
        timeZone: "UTC",
        queue: PARKED_JOBS_SWEEP.queue,
        job: PARKED_JOBS_SWEEP.job,
        payload: {},
    },
    {
        name: "system-history-retention",
        cron: "30 16 * * *",
        timeZone: "UTC",
        queue: "system_history_retention",
        job: "system_history_retention",
        payload: { doneDays: 1, failedDays: 7, batch: 5000 },
    },
    {
        // The retention of account_data (domain account-data): per declared type, its retention days and its time to live, in batches of
        // `batch` rows. Fifteen minutes after the system history sweep, so the two never overlap.
        name: "account-data-retention",
        cron: "45 16 * * *",
        timeZone: "UTC",
        queue: "account_data_retention",
        job: "account_data_retention",
        payload: { batch: 1000 },
    },
    {
        // The truth graph's timed upkeep (BR1): scheduled facts whose start has come take over, ended facts expire. It rides the brain
        // command job of the knowledge queue with this literal payload (domain brain `BRAIN_UPKEEP_PAYLOAD`, `isUpkeepTick`).
        name: "brain-upkeep",
        cron: "*/5 * * * *",
        timeZone: "UTC",
        queue: "knowledge",
        job: "brain.command",
        payload: { upkeep: "brain" },
    },
    {
        // The reconcile of the vector index against Postgres: one bounded, resumable run (domain vector-sync). Its own tick, not the
        // brain upkeep, so an index that is down never fails the truth graph upkeep and each has its own retries.
        name: "vector-reconcile",
        cron: "*/5 * * * *",
        timeZone: "UTC",
        queue: "vector_sync",
        job: "vector.reconcile",
        payload: {},
    },
]
