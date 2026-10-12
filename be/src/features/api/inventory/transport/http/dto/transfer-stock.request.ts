import { IsNumber, IsString, IsUUID, MaxLength, Min } from "class-validator"

/** The bounded HTTP request of move goods between two locations. */
export class TransferStockRequest {
    /** The item. */
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The source location. */
    @IsUUID("4")
    @MaxLength(36)
    fromLocationId!: string

    /** The target location. */
    @IsUUID("4")
    @MaxLength(36)
    toLocationId!: string

    /** The quantity to move. */
    @IsNumber()
    @Min(0)
    qty!: number

    /** A free note. */
    @IsString()
    @MaxLength(100)
    note!: string
}
