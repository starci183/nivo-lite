import { IsIn } from "class-validator"

/** The bounded HTTP request that grants a connection to an agent, or changes the grant. */
export class GrantAgentConnectionRequest {
    /** What the agent uses the connection for. */
    @IsIn(["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool", "lead_source"])
    purpose!: "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source"

    /** What the agent may do through the connection. */
    @IsIn(["read", "ask", "auto"])
    access!: "read" | "ask" | "auto"
}
