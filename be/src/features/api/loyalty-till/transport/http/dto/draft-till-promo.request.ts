import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsObject,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"

/** The segment of draft till promo body, as a named part. */
export class DraftTillPromoBodySegmentRequest {
    /** The tiers. */
    @IsArray()
    @ArrayMaxSize(8)
    @IsString({ each: true })
    @MaxLength(24, { each: true })
    tiers!: ReadonlyArray<string>

    /** The inactive_days. */
    @IsInt()
    @Min(0)
    @Max(3650)
    inactive_days!: number

    /** The birthday_this_month. */
    @IsBoolean()
    birthday_this_month!: boolean

    /** The min_spend_vnd. */
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    min_spend_vnd!: number
}

/** The bounded HTTP body of draft-till-promo. */
export class DraftTillPromoBodyRequest {
    /** The name. */
    @IsString()
    @MaxLength(100)
    name!: string

    /** The brief. */
    @IsString()
    @MaxLength(400)
    brief!: string

    /** The segment. */
    @IsObject()
    @ValidateNested()
    @Type(() => DraftTillPromoBodySegmentRequest)
    segment!: DraftTillPromoBodySegmentRequest
}
