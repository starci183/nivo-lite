/** The pgmq queue of the automations engine: its minute ticks. */
export const AUTOMATION_QUEUE = "automation"

/** The job of a minute tick: run the due runs, the scans and the extension ticks of every workspace. */
export const AUTOMATION_TICK_JOB = "automation.tick"

/** The pg_cron scheduler that sends a tick every minute; every replica upserts it by id and the deployment still fires it once a minute. */
export const AUTOMATION_TICK_SCHEDULER = {
    queue: AUTOMATION_QUEUE,
    job: AUTOMATION_TICK_JOB,
    id: "automation-tick",
    everyMs: 60_000,
} as const
