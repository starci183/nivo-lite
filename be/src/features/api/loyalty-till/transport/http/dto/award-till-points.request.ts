import { IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from "class-validator"

/** The bounded HTTP body of award-till-points. */
export class AwardTillPointsBodyRequest {
    /** The phone. */
    @IsString()
    @MaxLength(30)
    phone!: string

    /** The name. */
    @IsString()
    @MaxLength(120)
    name!: string

    /** The amount_vnd. */
    @IsNumber()
    @Min(1)
    @Max(1000000000000)
    amount_vnd!: number

    /** The ref. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    ref!: string

    /** The items. */
    @IsString()
    @MaxLength(300)
    items!: string

    /** The occurred_at. */
    @IsString()
    @MaxLength(40)
    occurred_at!: string
}
