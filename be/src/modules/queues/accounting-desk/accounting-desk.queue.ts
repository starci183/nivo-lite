/** The pgmq queue of the accounting desk: the morning run (daily summary card and due-date reminders). */
export const ACCOUNTING_DESK_QUEUE = "accounting_desk"

/** The job of the morning run, sent by pg_cron at 06:30 Vietnam time. */
export const ACCOUNTING_MORNING_JOB = "accounting_desk.morning"
