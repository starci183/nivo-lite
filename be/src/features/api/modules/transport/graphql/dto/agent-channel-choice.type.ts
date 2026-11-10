import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One channel connection a new agent of a role could answer, with the agent of the role that answers it already. */
export class AgentChannelChoiceType {
    /** The connection. */
    @Field(() => ID)
    connectionId!: string

    /** Its display name. */
    @Field()
    name!: string

    /** The provider: telegram, zalo_oa or meta. */
    @Field()
    provider!: string

    /** The bot username, when the provider has one. */
    @Field(() => String, { nullable: true })
    botUsername!: string | null

    /** connected, error or pending. */
    @Field()
    status!: string

    /** What an agent of the role uses it for: inbound_chat, outbound_chat or lead_source. */
    @Field()
    purpose!: string

    /** The agent of the role that answers it; null when it is free. */
    @Field(() => ID, { nullable: true })
    ownerAgentId!: string | null

    /** The display name of that agent (shown as "name is answering"); null when it is free. */
    @Field(() => String, { nullable: true })
    ownerAgentName!: string | null
}
