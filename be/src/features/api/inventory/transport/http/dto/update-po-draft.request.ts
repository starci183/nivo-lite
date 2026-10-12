import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"

/** One line to change. */
export class UpdatePoLineRequest {
    /** The line. */
    @IsUUID("4")
    @MaxLength(36)
    lineId!: string

    /** The quantity, as typed; zero removes the line. */
    @IsString()
    @MaxLength(30)
    qty!: string

    /** The unit cost, as typed. */
    @IsString()
    @MaxLength(30)
    unitCost!: string
}

/** The bounded HTTP request of edit a draft purchase order. */
export class UpdatePoDraftRequest {
    /** The purchase order. */
    @IsUUID("4")
    @MaxLength(36)
    poId!: string

    /** The supplier id; empty for none. */
    @IsString()
    @MaxLength(36)
    supplierId!: string

    /** The expected date, YYYY-MM-DD, or empty. */
    @IsString()
    @MaxLength(10)
    expectedAt!: string

    /** The lines to change. */
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => UpdatePoLineRequest)
    lines!: Array<UpdatePoLineRequest>
}
