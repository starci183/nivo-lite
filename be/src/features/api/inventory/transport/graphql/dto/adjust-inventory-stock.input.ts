import { Field, ID, Float, InputType } from "@nestjs/graphql"
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that change one item's quantity by hand. */
export class AdjustInventoryStockInput {
    /** The item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The location; absent means the default one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    locationId?: string

    /** The signed change in base units. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    delta?: number

    /** The counted quantity; it sets the level instead of adding. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    counted?: number

    /** Why the quantity changes. */
    @Field(() => String)
    @IsString()
    @MaxLength(300)
    reason!: string
}
