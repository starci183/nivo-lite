import { IsInt, IsNotEmpty, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

/** The bounded HTTP params of adjust-points. */
export class AdjustPointsParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The customer id. */
    @IsUUID()
    @MaxLength(36)
    customerId!: string
}

/** The bounded HTTP body of adjust-points. */
export class AdjustPointsBodyRequest {
    /** The points. */
    @IsInt()
    @Min(-1000000)
    @Max(1000000)
    points!: number

    /** The reason. */
    @IsString()
    @MaxLength(300)
    reason!: string

    /** The token. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    token!: string
}
