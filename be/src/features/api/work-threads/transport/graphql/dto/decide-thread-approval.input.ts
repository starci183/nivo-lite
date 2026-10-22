import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The card a member decides and how. */
export class DecideThreadApprovalInput {
    /** The message that carries the card. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    messageId!: string

    /** approve or reject. */
    @Field()
    @IsIn(["approve", "reject"])
    verdict!: "approve" | "reject"
}
