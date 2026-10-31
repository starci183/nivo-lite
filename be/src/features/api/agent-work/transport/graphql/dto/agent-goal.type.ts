import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One goal of an agent. */
export class AgentGoalType {
    /** The goal. */
    @Field(() => ID)
    id!: string

    /** Short title. */
    @Field()
    title!: string

    /** Longer text. */
    @Field()
    detail!: string

    /** active, paused, done or dropped. */
    @Field()
    status!: string

    /** owner, module or agent. */
    @Field()
    source!: string

    /** When it is due, ISO 8601, or null. */
    @Field(() => Date, { nullable: true })
    dueAt!: Date | null
}
