/** What an agent may do through a connection. */
export type AgentAccess = "read" | "ask" | "auto"

/** What an agent uses a connection for. */
export type AgentPurpose = "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source"
