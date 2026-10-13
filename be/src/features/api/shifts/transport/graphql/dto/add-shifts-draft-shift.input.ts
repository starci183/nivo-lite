import { Field, ID, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that add a shift to a draft schedule. */
export class AddShiftsDraftShiftInput {
    /** The draft schedule. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    scheduleId!: string

    /** The day, YYYY-MM-DD. */
    @Field(() => String)
    @IsString()
    @MaxLength(10)
    date!: string

    /** The start, HH:MM. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    start!: string

    /** The end, HH:MM. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    end!: string

    /** The position. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    positionId!: string

    /** The person, or null for an open shift. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    staffId?: string
}
