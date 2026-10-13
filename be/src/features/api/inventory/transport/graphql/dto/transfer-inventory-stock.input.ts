import { Field, ID, Float, InputType } from "@nestjs/graphql"
import { IsNumber, IsString, IsUUID, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments that move goods between two locations. */
export class TransferInventoryStockInput {
    /** The item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The source location. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    fromLocationId!: string

    /** The target location. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    toLocationId!: string

    /** The quantity to move. */
    @Field(() => Float)
    @IsNumber()
    @Min(0.000001)
    qty!: number

    /** A free note. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    note!: string
}
