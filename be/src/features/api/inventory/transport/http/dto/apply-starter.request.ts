import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"

/** One supplier of a starter. */
export class StarterSupplierRequest {
    /** The supplier name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The contact person. */
    @IsOptional()
    @IsString()
    @MaxLength(80)
    contactName?: string

    /** The order email address. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    email?: string

    /** The phone number. */
    @IsOptional()
    @IsString()
    @MaxLength(30)
    phone?: string

    /** The Zalo contact. */
    @IsOptional()
    @IsString()
    @MaxLength(60)
    zalo?: string

    /** How orders reach the supplier. */
    @IsString()
    @MaxLength(10)
    channel!: string

    /** The delivery time in days. */
    @IsInt()
    @Min(0)
    @Max(60)
    leadTimeDays!: number

    /** The payment terms. */
    @IsOptional()
    @IsString()
    @MaxLength(200)
    paymentTerms?: string
}

/** One other unit of an item. */
export class StarterUnitRequest {
    /** The unit name. */
    @IsString()
    @MaxLength(30)
    unit!: string

    /** How many base units one of this unit holds. */
    @IsNumber()
    @Min(0)
    factor!: number
}

/** One item of a starter. */
export class StarterItemRequest {
    /** The item code. */
    @IsString()
    @MaxLength(40)
    sku!: string

    /** The item name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The base unit. */
    @IsString()
    @MaxLength(30)
    unit!: string

    /** Other units. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @ValidateNested({ each: true })
    @Type(() => StarterUnitRequest)
    units?: Array<StarterUnitRequest>

    /** The item group. */
    @IsString()
    @MaxLength(60)
    category!: string

    /** The cost per base unit. */
    @IsNumber()
    @Min(0)
    costVnd!: number

    /** The selling price per base unit. */
    @IsOptional()
    @IsNumber()
    @Min(0)
    sellPriceVnd?: number

    /** The low-stock level. */
    @IsNumber()
    @Min(0)
    reorderPoint!: number

    /** The usual order quantity. */
    @IsNumber()
    @Min(0)
    reorderQty!: number

    /** The supplier name. */
    @IsOptional()
    @IsString()
    @MaxLength(120)
    supplier?: string

    /** Other names. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(80, { each: true })
    aliases?: Array<string>

    /** The opening quantity. */
    @IsNumber()
    @Min(0)
    qty!: number
}

/** One ingredient of a starter recipe. */
export class StarterRecipeLineRequest {
    /** The ingredient item code. */
    @IsString()
    @MaxLength(40)
    sku!: string

    /** The quantity per product. */
    @IsNumber()
    @Min(0)
    qty!: number
}

/** One recipe of a starter. */
export class StarterRecipeRequest {
    /** The product name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** Other names. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @MaxLength(80, { each: true })
    aliases?: Array<string>

    /** The ingredients. */
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => StarterRecipeLineRequest)
    lines!: Array<StarterRecipeLineRequest>
}

/** The bounded HTTP request of load a starter set of suppliers, items and recipes. */
export class ApplyStarterRequest {
    /** The starter name used in the log. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The suppliers to add. */
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => StarterSupplierRequest)
    suppliers!: Array<StarterSupplierRequest>

    /** The items to add. */
    @IsArray()
    @ArrayMaxSize(500)
    @ValidateNested({ each: true })
    @Type(() => StarterItemRequest)
    items!: Array<StarterItemRequest>

    /** The recipes to add. */
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => StarterRecipeRequest)
    recipes!: Array<StarterRecipeRequest>
}
