/** Whether and how an app runs the recurring ticks of platform/jobs. */
export interface JobsSchedulerOptions {
    /** Whether this app registers the ticks; only an app that runs jobs does, so a one-off cli run never fires one. */
    readonly enabled: boolean
}
