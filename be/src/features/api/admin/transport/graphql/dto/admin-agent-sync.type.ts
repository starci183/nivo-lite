import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The OpenClaw copy of an agent's context. */
export class AdminAgentSyncType {
    /** The agent id. */
    @Field(() => ID)
    agentId!: string

    /** The context version. */
    @Field(() => Int, { nullable: true })
    contextVersion!: number | null

    /** The checked at. */
    @Field()
    checkedAt!: string

    /** The status. */
    @Field()
    status!: string

    /** The error. */
    @Field(() => String, { nullable: true })
    error!: string | null
}
