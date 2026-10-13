import { Field, InputType, ID } from "@nestjs/graphql"
import { IsBoolean, IsDateString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for move booking. */
export class MoveBookingInput {
    /** The id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    id!: string

    /** The start at. */
    @Field(() => String)
    @IsDateString()
    @MaxLength(40)
    startAt!: string

    /** The resource id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    resourceId!: string

    /** The force. */
    @Field(() => Boolean)
    @IsBoolean()
    force!: boolean
}
