import { IsBoolean, IsInt, IsOptional, IsUUID, Max, Min, MaxLength } from "class-validator"
import { Field, ID, Int, InputType } from "@nestjs/graphql"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The approval of a public document. */
export class ApprovePublicDocumentInput {
    /** The public document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string

    /** The content revision actually reviewed; a stale review cannot approve newer text. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(2_147_483_647)
    expectedDraftRevision!: number

    /** True when the owner looked at the internal sources that changed and approves the text as it stands. */
    @Field(() => Boolean, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsBoolean()
    reviewedChanges?: boolean
}
