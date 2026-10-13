/** Log events of the automation runs capability. */
export enum AutomationRunsLogEvent {
    /** An execution threw; the run is stored failed and will be retried while it has attempts left. */
    RunFailed = "automation_runs.run_failed",
}
