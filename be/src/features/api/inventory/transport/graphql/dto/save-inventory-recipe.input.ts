import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { InventoryRecipeLineInput } from "./inventory-recipe-line.input"

@InputType()
/** The bounded arguments that create or update one recipe. */
export class SaveInventoryRecipeInput {
    /** The recipe to update; absent creates one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The product name as it appears on an order. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    name!: string

    /** Other names, separated by commas. */
    @Field(() => String)
    @IsString()
    @MaxLength(600)
    aliases!: string

    /** The ingredients per product. */
    @Field(() => [[InventoryRecipeLineInput]])
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => InventoryRecipeLineInput)
    lines!: Array<InventoryRecipeLineInput>
}
