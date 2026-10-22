import { Field, ObjectType } from "@nestjs/graphql"
import { WorkThreadType } from "./work-thread.type"
import { ThreadMessageType } from "./thread-message.type"

@ObjectType()
/** A thread with its newest messages, oldest first. */
export class WorkThreadViewType {
    /** The thread. */
    @Field(() => WorkThreadType)
    thread!: WorkThreadType

    /** The newest messages, oldest first. */
    @Field(() => [ThreadMessageType])
    messages!: ReadonlyArray<ThreadMessageType>
}
