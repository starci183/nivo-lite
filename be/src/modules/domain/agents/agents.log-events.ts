/** Log events of the agents capability. */
export enum AgentsLogEvent {
    /** A region of the agent dashboard could not be read. */
    DashboardRegionFailed = "agents.dashboard_region_failed",
    /** A care step was armed as a timer task of the agent: the agent, the step and the moment it is due, never the customer. */
    CareScheduled = "agents.care_scheduled",
}
