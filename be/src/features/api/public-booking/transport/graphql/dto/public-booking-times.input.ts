import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded service and day whose available starts are requested. */
export class PublicBookingTimesInput {
    /** The published booking page slug. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9-]{2,40}$/)
    @MaxLength(41)
    slug!: string

    /** The offered service id. */
    @Field()
    @IsUUID()
    @MaxLength(36)
    serviceId!: string

    /** The local date, YYYY-MM-DD. */
    @Field()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/)
    @MaxLength(10)
    date!: string

    /** The number of visitors. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(20)
    party!: number
}
