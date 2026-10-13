import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The optional local date range of the booking workbench. */
export class BookingBoardInput {
    /** The first local date, defaults to this Monday. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/u)
    @MaxLength(10)
    from?: string | null

    /** The last local date, defaults to six days after the first. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/u)
    @MaxLength(10)
    to?: string | null
}
