import { Field, Float, ID, ObjectType } from "@nestjs/graphql"
import { ThreadCardApproverType } from "./thread-card-approver.type"
import { ThreadCardExcludedType } from "./thread-card-excluded.type"
import { ThreadMentionType } from "./thread-mention.type"

@ObjectType()
/** The approval card a thread message carries. */
export class ThreadApprovalCardType {
    /** The approval request. */
    @Field(() => ID)
    requestId!: string

    /** What is asked. */
    @Field()
    action!: string

    /** The amount asked, in the unit. */
    @Field(() => Float, { nullable: true })
    amount!: number | null

    /** The unit of the amount. */
    @Field(() => String, { nullable: true })
    unit!: string | null

    /** The authority rule that governs the ask. */
    @Field()
    rule!: string

    /** any, all or sequential. */
    @Field()
    policy!: string

    /** When the ask expires, ISO 8601. */
    @Field()
    expiresAt!: string

    /** The people tagged. */
    @Field(() => [ThreadCardApproverType])
    approvers!: ReadonlyArray<ThreadCardApproverType>

    /** The people left out. */
    @Field(() => [ThreadCardExcludedType])
    excluded!: ReadonlyArray<ThreadCardExcludedType>

    /** pending, approved, rejected or expired. */
    @Field()
    outcome!: string

    /** The Auth user id of who decided. */
    @Field(() => String, { nullable: true })
    decidedBy!: string | null

    /** The name of who decided. */
    @Field(() => String, { nullable: true })
    decidedByName!: string | null

    /** When it was decided, ISO 8601. */
    @Field(() => String, { nullable: true })
    decidedAt!: string | null

    /** The owner an expired or refused ask goes back to. */
    @Field(() => ThreadMentionType, { nullable: true })
    owner!: ThreadMentionType | null
}
