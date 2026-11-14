import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An active agent that may be bound to a connection of a provider, and what it would do there. */
export class BindableAgentType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** `inbound_chat`, `outbound_chat`, `bank_feed`, `data_source` or `tool`. */
    @Field(() => String)
    purpose!: string
}
