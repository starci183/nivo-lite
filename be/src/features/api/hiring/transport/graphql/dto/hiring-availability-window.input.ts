import { Field, Int, InputType } from "@nestjs/graphql"
import { IsInt, Max, Min } from "class-validator"

@InputType()
/** One free window. */
export class HiringAvailabilityWindowInput {
    /** The weekday, 0 (Sunday) to 6. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(6)
    weekday!: number

    /** Minutes from midnight. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(1440)
    startMin!: number

    /** Minutes from midnight. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(1440)
    endMin!: number
}
