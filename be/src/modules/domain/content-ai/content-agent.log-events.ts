/** Log events of the AI Marketing capability. */
export enum ContentAgentLogEvent {
    /** A draft started from the Marketing room failed after the command was performed. */
    DraftFailed = "marketing.draft.failed",
    /** The images of a draft could not be composed or stored. */
    ImagesFailed = "marketing.images.failed",
    /** Scheduling an approved post failed as a whole. */
    ScheduleFailed = "marketing.schedule.failed",
    /** One channel refused to schedule a post. */
    ChannelRefused = "marketing.schedule.channel_refused",
    /** The insights sync of a workspace failed. */
    InsightsFailed = "marketing.insights.failed",
}
