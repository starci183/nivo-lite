import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"

/** One received line. */
export class ReceivePoLineRequest {
    /** The order line. */
    @IsUUID("4")
    @MaxLength(36)
    lineId!: string

    /** The received quantity, as typed. */
    @IsString()
    @MaxLength(30)
    qty!: string

    /** The actual unit cost, as typed; empty keeps the ordered cost. */
    @IsString()
    @MaxLength(30)
    unitCost!: string
}

/** The bounded HTTP request of receive goods against a purchase order. */
export class ReceivePoRequest {
    /** The purchase order. */
    @IsUUID("4")
    @MaxLength(36)
    poId!: string

    /** The supplier invoice number. */
    @IsString()
    @MaxLength(60)
    invoiceNo!: string

    /** A free note. */
    @IsString()
    @MaxLength(300)
    note!: string

    /** The received lines. */
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => ReceivePoLineRequest)
    lines!: Array<ReceivePoLineRequest>
}
