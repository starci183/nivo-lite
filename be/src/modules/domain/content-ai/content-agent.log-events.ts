/** Log events of the AI Marketing capability. */
export enum ContentAgentLogEvent {
    /** A draft started from the Marketing room failed after the command was performed. */
    DraftFailed = "marketing.draft.failed",
    /** The images of a draft could not be composed or stored. */
    ImagesFailed = "marketing.images.failed",
    /** Scheduling an approved post failed as a whole. */
    ScheduleFailed = "marketing.schedule.failed",
    /** One step or one workspace of the AI Marketing content tick failed; the tick goes on. */
    TickFailed = "marketing.tick.failed",
    /** Publishing a due post on a channel failed; an unreachable channel retries on the next tick. */
    PublishFailed = "marketing.publish.failed",
    /** One channel refused to schedule a post. */
    ChannelRefused = "marketing.schedule.channel_refused",
    /** The insights sync of a workspace failed. */
    InsightsFailed = "marketing.insights.failed",
    /** Reading the published posts of the report week from Meta failed; the report shows none. */
    PostsFailed = "marketing.insights.posts_failed",
    /** Reading the lessons or templates of a draft failed; the draft is written without that layer. */
    KnowledgeFailed = "marketing.draft.knowledge_failed",
    /** Handing the draft script to AI Editor failed or was refused. */
    VideoDelegationFailed = "marketing.video.delegation_failed",
}
