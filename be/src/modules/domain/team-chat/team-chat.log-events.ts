/** Log events of the team chat: ids and codes only, never the words of a person. */
export enum TeamChatLogEvent {
    /** The line listener failed on a person's new message; the message stays written and starts no turn (`roomId`). */
    LineListenerFailed = "team_chat.line_listener_failed",
    /** The reply listener failed on a person's reply to an agent's line; the reply stays written (`lineKey`). */
    ReplyListenerFailed = "team_chat.reply_listener_failed",
    /**
     * A post to the team chat was refused or failed (ruling R45: never silent): an app error is recorded beside this line and nothing is
     * posted about it (no recursion) (`workspaceId`, `agentId`, `runId`, `code`, `key`).
     */
    PostRefused = "team_chat.post_refused",
}
