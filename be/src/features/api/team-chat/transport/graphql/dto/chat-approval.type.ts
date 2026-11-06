import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ChatApprovalStatus } from "./chat-approval-status.type"

@ObjectType()
/** The decision an approval card is about. */
export class ChatApprovalType {
    /** The decision of the decisions core. */
    @Field(() => ID)
    decisionId!: string

    /** Where the decision stands. */
    @Field(() => ChatApprovalStatus)
    status!: string

    /** Who decided, once decided. */
    @Field(() => String, { nullable: true })
    decidedByName!: string | null

    /** When it was decided. */
    @Field(() => String, { nullable: true })
    decidedAt!: string | null

    /** Whether the viewer holds the right the decide door checks. */
    @Field(() => Boolean)
    canDecide!: boolean
}
