/** Log events of the lead generation flow. */
export enum LeadFlowsLogEvent {
    /** The model could not read a turn: the prospect goes to a person as unreadable. */
    TurnUnread = "lead_flows.turn_unread",
    /** The owner's setup facts could not be read: the default criteria and no questions are used. */
    SetupUnreadable = "lead_flows.setup_unreadable",
    /** The public knowledge could not be searched: the reply is written without it. */
    KnowledgeUnreadable = "lead_flows.knowledge_unreadable",
    /** A knowledge gap could not be remembered. */
    GapNotNoted = "lead_flows.gap_not_noted",
    /** The Messenger / Instagram id a private reply reached belongs to another flow: it is not linked. */
    PersonNotLinked = "lead_flows.person_not_linked",
}
