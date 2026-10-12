import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"

/** One ordered item. */
export class CreatePoLineRequest {
    /** The item. */
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The quantity, as typed. */
    @IsString()
    @MaxLength(30)
    qty!: string

    /** The unit cost, as typed. */
    @IsString()
    @MaxLength(30)
    unitCost!: string
}

/** The bounded HTTP request of create a purchase order. */
export class CreatePoRequest {
    /** The supplier id; empty for none. */
    @IsString()
    @MaxLength(36)
    supplierId!: string

    /** The expected date, YYYY-MM-DD, or empty. */
    @IsString()
    @MaxLength(10)
    expectedAt!: string

    /** The ordered items. */
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => CreatePoLineRequest)
    lines!: Array<CreatePoLineRequest>
}
