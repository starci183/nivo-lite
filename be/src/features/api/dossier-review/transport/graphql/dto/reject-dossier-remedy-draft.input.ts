import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** A draft to reject and why. */
export class RejectDossierRemedyDraftInput {
    /** The draft. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    draftId!: string

    /** Why, at most 500 characters. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason: string | null = null
}
