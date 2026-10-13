import { Type } from "class-transformer"
import { IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator"

/** The bounded HTTP params of list-free-times. */
export class ListFreeTimesParamsRequest {
    /** The slug. */
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{2,40}$/)
    @MaxLength(41)
    slug!: string
}

/** The bounded HTTP query of list-free-times. */
export class ListFreeTimesSearchRequest {
    /** The service. */
    @IsUUID()
    @MaxLength(36)
    service!: string

    /** The date. */
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    @MaxLength(10)
    date!: string

    /** The party. */
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(20)
    party!: number
}
