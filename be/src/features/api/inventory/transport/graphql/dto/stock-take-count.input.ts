import { Field, ID, Float, InputType } from "@nestjs/graphql"
import { IsNumber, IsUUID, MaxLength } from "class-validator"

@InputType()
/** One counted item. */
export class StockTakeCountInput {
    /** The item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The counted quantity. */
    @Field(() => Float)
    @IsNumber()
    counted!: number
}
