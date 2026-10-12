/** Log events of the agents capability. */
export enum AgentsLogEvent {
    /** A region of the agent dashboard could not be read. */
    DashboardRegionFailed = "agents.dashboard_region_failed",
    /** The standing memory of the brain could not be read; the bundle goes without it. */
    MemoryUnavailable = "agents.memory_unavailable",
}
