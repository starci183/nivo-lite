import { Field, ObjectType } from "@nestjs/graphql"
import { ChatApprovalType } from "./chat-approval.type"
import { ChatRefusal } from "./chat-refusal.type"

@ObjectType()
/** The state of the decision after the verdict, or why it was refused. */
export class ChatDecisionPayloadType {
    /** The state every card of the decision now shows. */
    @Field(() => ChatApprovalType, { nullable: true })
    approval!: ChatApprovalType | null

    /** Why the verdict was refused. */
    @Field(() => ChatRefusal, { nullable: true })
    refusal!: string | null
}
