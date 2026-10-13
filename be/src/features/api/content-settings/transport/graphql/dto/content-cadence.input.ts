import { Field, InputType, Int } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator"
import type { ContentChannel } from "@modules/domain/content-settings"

@InputType()
/** One channel's bounded posting rhythm. */
export class ContentCadenceInput {
    /** The publishing channel. */
    @Field(() => String)
    @IsIn(["facebook", "zalo", "tiktok", "instagram"])
    channel!: ContentChannel

    /** How many posts to plan each week. */
    @Field(() => Int)
    @IsInt()
    @Min(0)
    @Max(21)
    postsPerWeek!: number

    /** ISO weekdays, Monday is one. */
    @Field(() => [Int])
    @IsArray()
    @ArrayMaxSize(7)
    @IsInt({ each: true })
    @Min(1, { each: true })
    @Max(7, { each: true })
    days!: Array<number>

    /** Vietnam local posting time in HH:mm. */
    @Field()
    @IsString()
    @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    @MaxLength(5)
    time!: string
}
