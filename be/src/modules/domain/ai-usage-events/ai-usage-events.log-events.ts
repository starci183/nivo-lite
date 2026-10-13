/** Log events of usage metering. */
export enum AiUsageEventsLogEvent {
    /** A model call could not be booked; metering never breaks the reply. */
    RecordFailed = "usage.record.failed",
    /** The month's allowance could not be read, so the call goes ahead. */
    StatusFailed = "usage.status.failed",
    /** The owner notice could not be posted. */
    NoticeFailed = "usage.notice.failed",
}
