import { Field, InputType, Float, Int } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, Max, MaxLength, Min, ValidateNested } from "class-validator"
import { Type } from "class-transformer"
import { LoyaltyCategoryInput } from "./loyalty-category.input"

@InputType()
/** The bounded loyalty earn arguments. */
export class LoyaltyEarnInput {
    /** The per thousand vnd. */
    @Field(() => Float)
    @IsNumber()
    @Min(0)
    @Max(1000)
    perThousandVnd!: number

    /** The per visit. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(100000)
    perVisit!: number

    /** The categories. */
    @Field(() => [LoyaltyCategoryInput])
    @IsArray()
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => LoyaltyCategoryInput)
    categories!: ReadonlyArray<LoyaltyCategoryInput>

    /** The trigger. */
    @Field(() => String)
    @IsIn(["payment", "order"])
    @MaxLength(7)
    trigger!: string

    /** The min order vnd. */
    @Field(() => Float)
    @IsNumber()
    @Min(0)
    @Max(1e12)
    minOrderVnd!: number
}
