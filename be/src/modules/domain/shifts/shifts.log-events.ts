/** The structured log events of the shifts capability. */
export enum ShiftsLogEvent {
    /** A shift message did not go out on Telegram or Zalo; it is recorded as failed and the other channels still go. */
    NoticeFailed = "shifts.notice-failed",
    /** The evidence row of a shift message could not be written. */
    NoticeNotRecorded = "shifts.notice-not-recorded",
    /** A reminder or no-show check of one workspace could not be queued; the next tick tries again. */
    AlertScanFailed = "shifts.alert-scan-failed",
    /** The monthly hours close of one workspace failed; the next tick tries again. */
    MonthCloseFailed = "shifts.month-close-failed",
}
