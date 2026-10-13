import { Field, ID, Int, InputType } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
} from "class-validator"

@InputType()
/** The bounded arguments that create or update one coverage block. */
export class SaveShiftsCoverageInput {
    /** The block to update; absent creates one per weekday. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The weekdays covered (0 Monday to 6 Sunday). */
    @Field(() => [[Int]])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(7)
    @IsInt({ each: true })
    @Min(0, { each: true })
    @Max(6, { each: true })
    weekdays!: Array<number>

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

    /** The position. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    positionId!: string

    /** The fewest people needed. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    min!: number

    /** The ideal number of people. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    ideal!: number

    /** True for a busy window. */
    @Field(() => Boolean)
    @IsBoolean()
    peak!: boolean
}
