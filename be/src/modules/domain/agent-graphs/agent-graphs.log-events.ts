/** Log events of the action graph: ids only, never a customer's words or a rule's text. */
export enum AgentGraphsLogEvent {
    /** A refresh found a node graph the installed nodes no longer take; the version stays, and the owner must change the spec. */
    FlowUnsound = "agent_graphs.flow_unsound",
    /** The request of a branch ask could not be opened, so the item stays with the people who govern. */
    AskNotRouted = "agent_graphs.ask_not_routed",
    /** The contracts and gaps of a setup could not be proposed; the setup itself stands. */
    ContractSetupFailed = "agent_graphs.contract_setup_failed",
    /** An intent the published graph reaches has no frame, so a turn is offered the other intents without it. */
    IntentUnframed = "agent_graphs.intent_unframed",
    /** The flow of the live version could not be read, so its burst setting was not applied and the app default stands. */
    BurstFlowUnreadable = "agent_graphs.burst_flow_unreadable",
    /** The workflows of the agent could not be read for a wake, so the agent's own graph answered it unpinned. */
    WorkflowRouteFailed = "agent_graphs.workflow_route_failed",
    /** A customer wake of an agent that runs on workflows was taken by none of them: the founder is told, nothing runs. */
    WakeUntaken = "agent_graphs.wake_untaken",
    /** A wake named no trigger verb (its producer wrote none): nothing may take it, nothing runs, the founder is told. */
    WakeUnroutable = "agent_graphs.wake_unroutable",
    /**
     * An event of a verb the agent hears only through a `wait` came and no parked run of it took it (another render, a run that already
     * timed out): a normal no-op, nothing runs, nobody is told.
     */
    WakeNoWaiter = "agent_graphs.wake_no_waiter",
    /** A notice about a wake could not reach the team chat. */
    WakeNoticeSkipped = "agent_graphs.wake_notice_skipped",
    /** An agent graph version could not be read while the primary workflow adopted the agent's history, so it was left out. */
    WorkflowAdoptSkipped = "agent_graphs.workflow_adopt_skipped",
    /** The version a run is pinned to could not be read for what its node asks for on accounts; the node then asks for nothing. */
    NodeRequestUnreadable = "agent_graphs.node_request_unreadable",
    /** The pinned version's node states no mode (`auto | ask`): it has no request, and the engine gives it no default. */
    NodeModeUnstated = "agent_graphs.node_mode_unstated",
    /** The attachments or the grant rows could not be read on a road no person walks; the version goes through and is granted nothing. */
    NodeRightsUnreadable = "agent_graphs.node_rights_unreadable",
    /** The grant rows of a published version could not be named their workflow version: they stand and grant, naming no version. */
    RightsStampFailed = "agent_graphs.rights_stamp_failed",
    /** The notice of a publish whose follow-up was given up could not reach the team chat. */
    RightsNoticeSkipped = "agent_graphs.rights_notice_skipped",
    /** The freeze of the customer of a stopped run could not be recorded; the run raises its own review item instead. */
    FreezeFailed = "agent_graphs.freeze_failed",
    /** The engine refused to start a workflow another workflow called (depth, cycle, duplicate, scope or entry); the wake is skipped. */
    CallRefused = "agent_graphs.call_refused",
    /** A customer wrote while the agent is off duty and does not answer after hours: the wake waits for the next working hour. */
    HeldForHours = "agent_graphs.held_for_hours",
    /** A step could not complete: the raw technical cause, kept for developers whatever the AI core then decided. */
    StepTroubled = "agent_graphs.step_troubled",
    /** The AI core produced the output of a step that could not complete, and the run went on. */
    StepRecovered = "agent_graphs.step_recovered",
    /** A step nothing could complete was reported to the team in the team chat, and the run stops there for the founder. */
    StuckReported = "agent_graphs.stuck_reported",
    /** The customer of a stopped run's conversation could not be read; the card names none. */
    StuckLeadUnread = "agent_graphs.stuck_lead_unread",
    /** The cards of a run that ended well could not be marked resolved; they keep their last words. */
    StuckResolveFailed = "agent_graphs.stuck_resolve_failed",
    /** The name of a stopped run's workflow could not be read; the card names it from its template or key. */
    WorkflowNameFailed = "agent_graphs.workflow_name_failed",
    /** The line the AI core chose for the customer of a stuck run went out. */
    StuckLineSent = "agent_graphs.stuck_line_sent",
    /** The line the AI core chose for the customer could not go out (nobody to write to, or the channel refused). */
    StuckLineSkipped = "agent_graphs.stuck_line_skipped",
    /** The workflows of an agent's plugin could not be made at a door that goes on without them; the next door tries again. */
    WorkflowInstallFailed = "agent_graphs.workflow_install_failed",
    /** One run of `cli agents install-workflows` ended: how many workspaces and agents it walked, what it added, what failed. */
    WorkflowInstallRun = "agent_graphs.workflow_install_run",
    /** A person's queued start of a workflow was delivered and no live registration of the agent took it (paused or replaced since). */
    WorkflowStartUntaken = "agent_graphs.workflow_start_untaken",
}
