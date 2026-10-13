import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** One line to change. */
export class UpdatePoLineInput {
    /** The line. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    lineId!: string

    /** The quantity, as typed; zero removes the line. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    qty!: string

    /** The unit cost, as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    unitCost!: string
}
