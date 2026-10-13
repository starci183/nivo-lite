import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, ValidateNested } from "class-validator"
import { StockTakeCountInput } from "./stock-take-count.input"

@InputType()
/** The bounded arguments that apply a stock count. */
export class TakeInventoryStockInput {
    /** The counted items. */
    @Field(() => [StockTakeCountInput])
    @IsArray()
    @ArrayMaxSize(500)
    @ValidateNested({ each: true })
    @Type(() => StockTakeCountInput)
    counts!: Array<StockTakeCountInput>
}
