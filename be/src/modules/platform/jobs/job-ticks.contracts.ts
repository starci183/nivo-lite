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
        name: "agents-sync-all",
        cron: "*/5 * * * *",
        timeZone: "UTC",
        queue: "agents",
        job: "agents.sync",
        payload: {},
    },
    {
        name: "automation-tick",
        cron: "*/1 * * * *",
        timeZone: "UTC",
        queue: "automation",
        job: "automation.tick",
        payload: {},
    },
    {
        name: "connection-health-tick",
        cron: "*/15 * * * *",
        timeZone: "UTC",
        queue: "connection_health",
        job: "connection_health",
        payload: { silentAfterHours: 72 },
    },
    {
        name: "content-tick",
        cron: "*/15 * * * *",
        timeZone: "UTC",
        queue: "content_tick",
        job: "content_tick",
        payload: {},
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
        name: "decisions-drain-work",
        cron: "*/1 * * * *",
        timeZone: "UTC",
        queue: "decisions",
        job: "decisions.drain-work",
        payload: {},
    },
    {
        name: "decisions-expire-approvals",
        cron: "*/1 * * * *",
        timeZone: "UTC",
        queue: "decisions",
        job: "decisions.expire-approvals",
        payload: {},
    },
    {
        name: "shifts-tick",
        cron: "*/1 * * * *",
        timeZone: "UTC",
        queue: "shifts_alerts",
        job: "shifts.tick",
        payload: { kind: "tick" },
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
        name: "accounting-desk-morning",
        cron: "30 23 * * *",
        timeZone: "UTC",
        queue: "accounting_desk",
        job: "accounting_desk.morning",
        payload: {},
    },
    {
        name: "marketing-tick",
        cron: "*/15 * * * *",
        timeZone: "UTC",
        queue: "marketing_tick",
        job: "marketing_tick",
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
        name: "system-history-retention",
        cron: "30 16 * * *",
        timeZone: "UTC",
        queue: "system_history_retention",
        job: "system_history_retention",
        payload: { doneDays: 1, failedDays: 7, batch: 5000 },
    },
]
