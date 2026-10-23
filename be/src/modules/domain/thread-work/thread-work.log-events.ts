/** Log events of the agents' work in threads. */
export enum ThreadWorkLogEvent {
    /** A settled approval could not move the work on; the next tick tries again. */
    ResumeFailed = "thread_work.resume_failed",
    /** A member's answer could not move the work on; the work keeps waiting for them. */
    ReplyFailed = "thread_work.reply_failed",
}
