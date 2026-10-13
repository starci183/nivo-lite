import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Grants a connection to an agent, or changes the grant. */
export class GrantAgentConnectionInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    agentId!: string

    /** The connection. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    connectionId!: string

    /** What the agent uses the connection for. */
    @Field()
    @IsIn(["inbound_chat", "outbound_chat", "bank_feed", "data_source", "tool", "lead_source"])
    purpose!: "inbound_chat" | "outbound_chat" | "bank_feed" | "data_source" | "tool" | "lead_source"

    /** What the agent may do through the connection. */
    @Field()
    @IsIn(["read", "ask", "auto"])
    access!: "read" | "ask" | "auto"
}
