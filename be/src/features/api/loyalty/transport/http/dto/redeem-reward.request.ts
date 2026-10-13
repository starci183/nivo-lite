import { IsNotEmpty, IsString, IsUUID, MaxLength } from "class-validator"

/** The bounded HTTP params of redeem-reward. */
export class RedeemRewardParamsRequest {
    /** The workspace id. */
    @IsUUID()
    @MaxLength(36)
    workspaceId!: string

    /** The customer id. */
    @IsUUID()
    @MaxLength(36)
    customerId!: string
}

/** The bounded HTTP body of redeem-reward. */
export class RedeemRewardBodyRequest {
    /** The reward id. */
    @IsUUID()
    @MaxLength(36)
    rewardId!: string

    /** The token. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(64)
    token!: string
}
