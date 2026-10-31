import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** The owner's edits of a proposed draft. */
export class SaveDossierRemedyDraftInput {
    /** The draft. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    draftId!: string

    /** The title, 3 to 160 characters. */
    @Field(() => String)
    @IsString()
    @MinLength(3)
    @MaxLength(160)
    title!: string

    /** The Markdown body, 1 to 40,000 characters. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(40000)
    body!: string
}
