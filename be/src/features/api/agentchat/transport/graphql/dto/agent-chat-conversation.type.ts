import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The AgentChatConversation GraphQL result. */
export class AgentChatConversationType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The kind value. */
    @Field()
    kind!: string

    /** The channel value. */
    @Field()
    channel!: string

    /** The visitorName value. */
    @Field(() => String, { nullable: true })
    visitorName!: string | null

    /** The leadId value. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The handledBy value. */
    @Field(() => String, { nullable: true })
    handledBy!: string | null

    /** The createdAt value. */
    @Field()
    createdAt!: string
}
