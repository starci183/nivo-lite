import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** A waiting public reply, optionally edited before approval. */
export class ApproveLeadGenCommentInput {
    /** The public-comment work item. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workItemId!: string

    /** Omit or null to keep the proposed draft. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(4000)
    draft?: string | null
}
