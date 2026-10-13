import { Field, ID, Float, InputType } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    Min,
} from "class-validator"

@InputType()
/** The bounded arguments that create or update one person's shifts profile. */
export class SaveShiftsStaffInput {
    /** The profile to update; absent creates one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The person's name. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    name!: string

    /** The positions they can work. */
    @Field(() => [[ID]])
    @IsArray()
    @ArrayMaxSize(30)
    @IsUUID("4", { each: true })
    positionIds!: Array<string>

    /** The hourly wage in dong; absent keeps or writes zero. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    wage?: number

    /** The most hours a week. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    maxWeek?: number

    /** The most hours a day. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    maxDay?: number

    /** The fewest hours of rest between days. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    minRest?: number

    /** The shop's staff row this profile links to. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    staffRowId?: string

    /** The phone number. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    phone?: string

    /** The Telegram chat shift messages also go to. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    telegramChatId?: string

    /** The Zalo user shift messages also go to. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    zaloUserId?: string

    /** False once the person has left. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    active?: boolean
}
