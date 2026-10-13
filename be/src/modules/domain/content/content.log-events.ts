/** Log events of the content capability. */
export enum ContentLogEvent {
    /** The automations of one workspace failed in a tick; the other workspaces still ran. */
    TickFailed = "content.tick.failed",
    /** One automation of a workspace did something in a tick. */
    TickDone = "content.tick.done",
}
