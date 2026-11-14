/** Log events of the conversations capability: ids and counts only. */
export enum ConversationsLogEvent {
    /** A hand-back found no registered trigger declaration for the route's channel, so nothing could be delivered. */
    ResumeUndeclared = "conversations.resume_undeclared",
    /** A hand-back named a route that is not found (its contact erased) or holds no account, so nothing was delivered. */
    ResumeNoRoute = "conversations.resume_no_route",
}
