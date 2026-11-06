import { Field, ID, ObjectType } from "@nestjs/graphql"


@ObjectType()
/** The run a report message is about. */
export class ChatReportRefType {
    /** The run. */
    @Field(() => ID)
    runId!: string

    /** The agent that ran it. */
    @Field(() => ID)
    agentId!: string
}
