import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One task an agent is on. */
export class AgentTaskType {
    /** The task. */
    @Field(() => ID)
    id!: string

    /** The key the agent named it by. */
    @Field()
    dedupeKey!: string

    /** Short title. */
    @Field()
    title!: string

    /** Longer text. */
    @Field()
    detail!: string

    /** open or waiting. */
    @Field()
    status!: string

    /** approval, member or event, when it waits. */
    @Field(() => String, { nullable: true })
    waitingOn!: string | null

    /** When the agent wants to wake for it, ISO 8601, or null. */
    @Field(() => Date, { nullable: true })
    nextActionAt!: Date | null

    /** The work item it opened, or null. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null
}
