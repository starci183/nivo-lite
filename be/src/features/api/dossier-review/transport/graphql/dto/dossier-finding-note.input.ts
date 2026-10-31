import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** A finding and an optional note. */
export class DossierFindingNoteInput {
    /** The finding. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string

    /** Why, at most 500 characters. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note: string | null = null
}
