import { Field, InputType, ID } from "@nestjs/graphql"
import { IsBoolean, IsOptional, IsString, IsUUID, Matches, MaxLength } from "class-validator"

@InputType()
/** Bounded arguments for save booking exception. */
export class SaveBookingExceptionInput {
    /** The resource id. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    resourceId?: string | null

    /** The date. */
    @Field(() => String)
    @IsString()
    @Matches(/^\d{4}-\d{2}-\d{2}$/u)
    @MaxLength(10)
    date!: string

    /** The closed. */
    @Field(() => Boolean)
    @IsBoolean()
    closed!: boolean

    /** The start. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    start!: string

    /** The end. */
    @Field(() => String)
    @IsString()
    @MaxLength(5)
    end!: string

    /** The note. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    note!: string
}
