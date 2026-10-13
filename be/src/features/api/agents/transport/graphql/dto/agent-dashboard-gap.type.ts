import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One question the agent could not answer. */
export class AgentDashboardGapType {
    /** The gap. */
    @Field(() => ID)
    id!: string

    /** The question, clipped. */
    @Field()
    question!: string

    /** How often it was asked. */
    @Field(() => Int)
    count!: number

    /** When it was last asked, ISO 8601. */
    @Field()
    lastSeenAt!: string
}
