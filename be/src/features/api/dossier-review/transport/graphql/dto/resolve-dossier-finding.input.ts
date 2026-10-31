import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { Field, ID, InputType } from "@nestjs/graphql"

@InputType()
/** A finding to mark as done and what was done. */
export class ResolveDossierFindingInput {
    /** The finding. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string

    /** What was done, 3 to 500 characters. */
    @Field(() => String)
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    note!: string
}
