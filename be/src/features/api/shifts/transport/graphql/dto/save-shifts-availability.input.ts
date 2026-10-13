import { Field, ID, Int, InputType } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded arguments that add an availability statement. */
export class SaveShiftsAvailabilityInput {
    /** The person; the manager's statements approve at once, a member's own wait for approval. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    staffId?: string

    /** The weekday of a recurring statement; null with `date`. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(6)
    weekday?: number

    /** The date of a one-day statement; null with `weekday`. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    date?: string

    /** The window start, HH:MM. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    start!: string

    /** The window end, HH:MM. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    end!: string

    /** True when the person can work in the window. */
    @Field(() => Boolean)
    @IsBoolean()
    available!: boolean

    /** A free note. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(300)
    note?: string
}
