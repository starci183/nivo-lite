import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** A finding to dismiss and why. */
export class DismissDossierFindingInput {
    /** The finding. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string

    /** Why, 3 to 500 characters. */
    @Field(() => String)
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    reason!: string
}
