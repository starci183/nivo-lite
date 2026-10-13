import { IsNotEmpty, IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of redeem-till-reward. */
export class RedeemTillRewardBodyRequest {
    /** The phone. */
    @IsString()
    @MaxLength(30)
    phone!: string

    /** The customer_id. */
    @IsString()
    @MaxLength(36)
    customer_id!: string

    /** The reward_key. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(40)
    reward_key!: string

    /** The ref. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    ref!: string
}
