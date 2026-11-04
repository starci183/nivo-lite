/** What the agent-runs capability is told by the app root; every field has a default. */
export interface AgentRunsOptions {
    /** Names the running build; a run parked under another build is run again when this one starts. Without it no run is resumed by a build change. */
    readonly buildId?: string | undefined
    /** How long a run stays parked before the sweep runs it again on its own, minutes. */
    readonly parkSweepMinutes?: number | undefined
    /** The most times the machine resumes one parked run on its own; past it only a person resumes. */
    readonly parkMaxResumes?: number | undefined
}
