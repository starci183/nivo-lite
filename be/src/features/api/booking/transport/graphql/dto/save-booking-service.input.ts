import { Field, InputType, ID, Int } from "@nestjs/graphql"
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** Bounded arguments for save booking service. */
export class SaveBookingServiceInput {
    /** The id. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    id?: string | null

    /** The name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(160)
    name!: string

    /** The description. */
    @Field(() => String)
    @IsString()
    @MaxLength(600)
    description!: string

    /** The duration min. */
    @Field(() => Int)
    @IsInt()
    @Min(5)
    @Max(1440)
    durationMin!: number

    /** The buffer min. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(480)
    bufferMin!: number

    /** The price vnd. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000)
    priceVnd?: number | null

    /** The resource kind. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    resourceKind!: string

    /** The followup days. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(730)
    followupDays?: number | null

    /** The active. */
    @Field(() => Boolean)
    @IsBoolean()
    active!: boolean
}
