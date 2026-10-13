import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that decide a pending availability statement. */
export class DecideShiftsAvailabilityInput {
    /** The statement. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    id!: string

    /** Whether to approve it. */
    @Field(() => Boolean)
    @IsBoolean()
    approve!: boolean
}
