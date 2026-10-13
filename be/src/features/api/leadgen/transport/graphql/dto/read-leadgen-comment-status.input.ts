import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** The public-comment approval whose job progress is requested. */
export class ReadLeadGenCommentStatusInput {
    /** Identity returned by approveLeadGenComment. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workItemId!: string
}
