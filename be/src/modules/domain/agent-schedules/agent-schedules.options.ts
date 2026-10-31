/** What the app root decides for the agent-schedules capability. */
export interface AgentSchedulesOptions {
    /**
     * True in the app that runs the agents' work: it adds the handler of `internal` and `schedule` wakes and the services that turn
     * internal events into wakes and seed a module's triggers. They need the turn, the inbox and the installations; a world that only
     * proves the clock leaves it off.
     */
    readonly reactive?: boolean
}
