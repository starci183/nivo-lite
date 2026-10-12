import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"

/** One ingredient of a recipe. */
export class SaveRecipeLineRequest {
    /** The ingredient item. */
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The quantity per product, as typed. */
    @IsString()
    @MaxLength(30)
    qty!: string
}

/** The bounded HTTP request of create or update one recipe. */
export class SaveRecipeRequest {
    /** The recipe to update; absent creates one. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The product name as it appears on an order. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** Other names, separated by commas. */
    @IsString()
    @MaxLength(400)
    aliases!: string

    /** The ingredients per product. */
    @IsArray()
    @ArrayMaxSize(100)
    @ValidateNested({ each: true })
    @Type(() => SaveRecipeLineRequest)
    lines!: Array<SaveRecipeLineRequest>
}
