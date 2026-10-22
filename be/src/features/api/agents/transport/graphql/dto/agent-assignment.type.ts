import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The thread an assignment opened. */
export class AgentAssignmentType {
    /** The thread. */
    @Field(() => ID)
    threadId!: string
}
