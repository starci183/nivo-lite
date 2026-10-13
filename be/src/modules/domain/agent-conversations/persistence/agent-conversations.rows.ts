/** A conversation as the intake reads it. */
export interface ConversationRefRow {
    /** The conversation id. */
    readonly id: string
    /** The agent that speaks in it. */
    readonly agent_id: string
    /** The lead the customer became. */
    readonly lead_id: string | null
    /** Who holds the conversation when a person took it over. */
    readonly handled_by: string | null
    /** The customer's name. */
    readonly visitor_name: string | null
}

/** Where a conversation's replies go. */
export interface ConversationTargetRow {
    /** The conversation id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The channel key. */
    readonly channel: string
    /** The customer's id on the channel. */
    readonly external_id: string | null
    /** The connection the conversation came in on. */
    readonly connection_id: string | null
}

/** The conversation of a turn joined with the agent that speaks in it, as FIND_TURN_CONVERSATION selects it. */
export interface TurnConversationRow extends ConversationTargetRow {
    /** The lead the customer became. */
    readonly lead_id: string | null
    /** Who holds the conversation when a person took it over. */
    readonly handled_by: string | null
    /** The customer's name. */
    readonly visitor_name: string | null
    /** The module installation of the conversation. */
    readonly installation_id: string | null
    /** The agent id. */
    readonly agent_id: string
    /** The agent's display name. */
    readonly agent_name: string
    /** The agent's handle. */
    readonly agent_handle: string
    /** The agent's role line. */
    readonly agent_role: string
    /** The agent's module. */
    readonly agent_module: string
    /** The owner's instructions. */
    readonly agent_instructions: string
    /** The agent's knowledge. */
    readonly agent_knowledge: string
    /** The agent's approval rule. */
    readonly agent_approval_rule: string
    /** The agent's greeting. */
    readonly agent_greeting: string
}

/** The latest customer conversation of a lead. */
export interface LeadConversationRow {
    /** The conversation id. */
    id: string
    /** The agent that speaks in it. */
    agent_id: string
    /** The channel key. */
    channel: string
    /** The customer's name. */
    visitor_name: string | null
}
