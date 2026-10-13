import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsObject,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"

/** The bounded HTTP params of draft-campaign. */
export class DraftCampaignParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string
}

/** The segment of draft campaign body, as a named part. */
export class DraftCampaignBodySegmentRequest {
    /** The tiers. */
    @IsArray()
    @ArrayMaxSize(8)
    @IsString({ each: true })
    @MaxLength(24, { each: true })
    tiers!: ReadonlyArray<string>

    /** The inactive days. */
    @IsInt()
    @Min(0)
    @Max(3650)
    inactiveDays!: number

    /** The birthday this month. */
    @IsBoolean()
    birthdayThisMonth!: boolean

    /** The min spend vnd. */
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    minSpendVnd!: number
}

/** The bounded HTTP body of draft-campaign. */
export class DraftCampaignBodyRequest {
    /** The name. */
    @IsString()
    @MaxLength(100)
    name!: string

    /** The segment. */
    @IsObject()
    @ValidateNested()
    @Type(() => DraftCampaignBodySegmentRequest)
    segment!: DraftCampaignBodySegmentRequest

    /** The brief. */
    @IsString()
    @MaxLength(400)
    brief!: string
}
