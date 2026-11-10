/** Log events of the owner's doors onto the agents' work: kinds and outcomes only, never a customer or their words. */
export enum AgentDoorsLogEvent {
    /** A person ran a scheduled item now: its kind and what it came to. */
    RunNow = "agent_doors.run_now",
    /** A person set or cleared a customer's care opt-out. */
    CareOptOutSet = "agent_doors.care_opt_out_set",
}
