import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments of setSyncSchedule. */
export class SetSyncScheduleInput {
    /** The data connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** Minutes between two scheduled syncs, 5 to 10080; null is manual only. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(5)
    @Max(10_080)
    everyMinutes!: number | null
}
