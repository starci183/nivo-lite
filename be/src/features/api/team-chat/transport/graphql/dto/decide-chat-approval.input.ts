import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"
import { ChatVerdict } from "./chat-verdict.type"

@InputType()
/** Answers the decision an approval card is about. */
export class DecideChatApprovalInput {
    /** The decision: the decisionId of the approval of the card. */
    @Field(() => ID)
    @IsUUID("all")
    @MaxLength(36)
    decisionId!: string

    /** Approve or reject. */
    @Field(() => ChatVerdict)
    @IsIn(["approve", "reject"])
    verdict!: string
}
