import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** One ingredient of a recipe. */
export class InventoryRecipeLineInput {
    /** The ingredient item. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The quantity per product, as typed. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    qty!: string
}
