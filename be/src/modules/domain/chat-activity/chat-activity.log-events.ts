/** Log events of the chat activity capability. */
export enum ChatActivityLogEvent {
    /** A notification could not be pushed; the change itself was stored, clients catch up on their next refetch. */
    PublishFailed = "chat-activity.publish.failed",
}
