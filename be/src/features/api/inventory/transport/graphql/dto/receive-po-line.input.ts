import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** One received line. */
export class ReceivePoLineInput {
    /** The order line. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    lineId!: string

    /** The received quantity, as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    qty!: string

    /** The actual unit cost, as typed; empty keeps the ordered cost. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    unitCost!: string
}
