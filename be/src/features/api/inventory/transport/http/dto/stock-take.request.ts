import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsNumber, IsUUID, MaxLength, Min, ValidateNested } from "class-validator"

/** One counted item. */
export class StockTakeCountRequest {
    /** The item. */
    @IsUUID("4")
    @MaxLength(36)
    itemId!: string

    /** The counted quantity. */
    @IsNumber()
    @Min(0)
    counted!: number
}

/** The bounded HTTP request of apply a stock count. */
export class StockTakeRequest {
    /** The counted items. */
    @IsArray()
    @ArrayMaxSize(500)
    @ValidateNested({ each: true })
    @Type(() => StockTakeCountRequest)
    counts!: Array<StockTakeCountRequest>
}
