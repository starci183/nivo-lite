import { Field, InputType, ID, Float, Int } from "@nestjs/graphql"
import {
    IsBoolean,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator"

@InputType()
/** The bounded save loyalty reward arguments. */
export class SaveLoyaltyRewardInput {
    /** The id. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    id?: string | null

    /** The key. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    key?: string | null

    /** The name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(80)
    name!: string

    /** The kind. */
    @Field(() => String)
    @IsIn(["voucher", "item", "percent"])
    @MaxLength(8)
    kind!: string

    /** The value vnd. */
    @Field(() => Float)
    @IsNumber()
    @Min(0)
    @Max(1e12)
    valueVnd!: number

    /** The percent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    percent?: number | null

    /** The points cost. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(1000000000)
    pointsCost!: number

    /** The stock. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000)
    stock?: number | null

    /** The per customer limit. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000000000)
    perCustomerLimit?: number | null

    /** The min tier key. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(24)
    minTierKey?: string | null

    /** The note. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    note!: string

    /** The active. */
    @Field(() => Boolean)
    @IsBoolean()
    active!: boolean
}
