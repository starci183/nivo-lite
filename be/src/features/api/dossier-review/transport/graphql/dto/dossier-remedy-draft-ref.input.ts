import { IsUUID, MaxLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** A draft. */
export class DossierRemedyDraftRefInput {
    /** The draft. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    draftId!: string
}
