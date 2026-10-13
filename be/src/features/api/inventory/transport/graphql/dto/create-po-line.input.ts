import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** One ordered item. */
export class CreatePoLineInput {
    /** The item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The quantity, as typed. */
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
