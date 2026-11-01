import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The AgentChatPage GraphQL result. */
export class AgentChatPageType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The module value. */
    @Field()
    module!: string

    /** The name value. */
    @Field()
    name!: string

    /** The handle value. */
    @Field()
    handle!: string

    /** The role value. */
    @Field()
    role!: string

    /** The HTTPS address of the agent's picture; null for the default mascot. */
    @Field(() => String, { nullable: true })
    avatarUrl!: string | null

    /** The isActive value. */
    @Field(() => Boolean)
    isActive!: boolean

    /** The hasCustomerChannel value. */
    @Field(() => Boolean)
    hasCustomerChannel!: boolean

    /** The workspaceId value. */
    @Field(() => ID)
    workspaceId!: string

    /** The showWelcome value. */
    @Field(() => Boolean)
    showWelcome!: boolean
}
