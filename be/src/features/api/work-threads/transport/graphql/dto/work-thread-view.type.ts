import { Field, Int, ObjectType } from "@nestjs/graphql"
import { WorkThreadType } from "./work-thread.type"
import { ThreadMessageType } from "./thread-message.type"

@ObjectType()
/** How many distinct people and agents took part in a thread. */
export class ThreadParticipantsType {
    /** Distinct members who wrote or were tagged. */
    @Field(() => Int)
    people!: number

    /** Distinct agents who wrote or were tagged. */
    @Field(() => Int)
    agents!: number
}

@ObjectType()
/** A thread with its newest messages, oldest first. */
export class WorkThreadViewType {
    /** The thread. */
    @Field(() => WorkThreadType)
    thread!: WorkThreadType

    /** The people and agents who wrote or were tagged anywhere in the thread, not only in the newest messages. */
    @Field(() => ThreadParticipantsType)
    participants!: ThreadParticipantsType

    /** The newest messages, oldest first. */
    @Field(() => [ThreadMessageType])
    messages!: ReadonlyArray<ThreadMessageType>
}
