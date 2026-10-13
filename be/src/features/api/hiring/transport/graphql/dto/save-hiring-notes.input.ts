import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that save the notes about a candidate. */
export class SaveHiringNotesInput {
    /** The candidate. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** The notes. */
    @Field(() => String)
    @IsString()
    @MaxLength(10000)
    notes!: string
}
