import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP request of change one item's quantity by hand. */
export class AdjustStockRequest {
    /** The item. */
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The location; absent means the default one. */
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    locationId?: string

    /** The signed change in base units. */
    @IsOptional()
    @IsNumber()
    delta?: number

    /** The counted quantity; it sets the level instead of adding. */
    @IsOptional()
    @IsNumber()
    counted?: number

    /** Why the quantity changes. */
    @IsString()
    @MaxLength(160)
    reason!: string
}
