import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** A content draft selected for approval. */
export class SubmitContentForApprovalInput {
    /** The content item within the selected workspace. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}
