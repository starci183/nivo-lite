import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One connection bound to the agent. */
export class AgentDashboardConnectionType {
    /** The connection. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field()
    name!: string

    /** The provider key. */
    @Field()
    provider!: string

    /** The bot username, when the provider has one. */
    @Field(() => String, { nullable: true })
    botUsername!: string | null

    /** The masked bank account, when the connection is a bank feed. */
    @Field(() => String, { nullable: true })
    accountMasked!: string | null

    /** `connected`, `error` or `pending`. */
    @Field()
    status!: string

    /** What the agent may do through it. */
    @Field()
    access!: string

    /** What the agent uses it for. */
    @Field()
    purpose!: string
}
