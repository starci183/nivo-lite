import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { ThreadMentionRefType } from "./thread-mention-ref.type"

@ObjectType()
/** One step of a thread's chain. */
export class ChainStepType {
    /** The step id. */
    @Field(() => ID)
    id!: string

    /** The place of the step in its chain, from 1. */
    @Field(() => Int)
    seq!: number

    /** member or agent. */
    @Field()
    actorKind!: string

    /** The actor id. */
    @Field()
    actorId!: string

    /** The actor's display name. */
    @Field()
    actorName!: string

    /** The member's role or the agent's module. */
    @Field()
    actorRole!: string

    /** self, ask_approval, hand_off or assign. */
    @Field()
    kind!: string

    /** The short title. */
    @Field()
    action!: string

    /** The line under the title. */
    @Field()
    detail!: string

    /** The authority rule that governed it. */
    @Field(() => String, { nullable: true })
    rule!: string | null

    /** Who it tags. */
    @Field(() => ThreadMentionRefType, { nullable: true })
    target!: ThreadMentionRefType | null

    /** The approval request it waits on. */
    @Field(() => String, { nullable: true })
    approvalRequestId!: string | null

    /** waiting, done, rejected, expired or stopped. */
    @Field()
    status!: string

    /** The member who decided it. */
    @Field(() => String, { nullable: true })
    decidedBy!: string | null

    /** When it began, ISO 8601. */
    @Field()
    startedAt!: string

    /** When it ended, ISO 8601. */
    @Field(() => String, { nullable: true })
    finishedAt!: string | null
}
