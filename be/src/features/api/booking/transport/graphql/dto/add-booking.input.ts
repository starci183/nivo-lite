import { Field, InputType, ID, Int } from "@nestjs/graphql"
import {
    IsBoolean,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator"

@InputType()
/** Bounded arguments for add booking. */
export class AddBookingInput {
    /** The service id. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    serviceId!: string

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

    /** The time. */
    @Field(() => String)
    @IsString()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/u)
    @MaxLength(5)
    time!: string

    /** The party. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(200)
    party!: number

    /** The name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name!: string

    /** The phone. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string | null

    /** The note. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(400)
    note?: string | null

    /** The force. */
    @Field(() => Boolean)
    @IsBoolean()
    force!: boolean
}
