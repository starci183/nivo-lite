import { Field, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsIn, IsInt, IsOptional, Max, MaxLength, Min, ValidateNested } from "class-validator"
import { OFFICE_ROOM_KEYS } from "@modules/domain/messages"
import { OfficeThreadCursorInput } from "./office-thread-cursor.input"

@InputType()
/** The bounded arguments of the thread listing. */
export class ListOfficeMessagesInput {
    /** Where the page starts: the `next` cursor of the previous page. */
    @Field(() => OfficeThreadCursorInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => OfficeThreadCursorInput)
    before: OfficeThreadCursorInput | null = null

    /** The page size, 1 to 100; 50 when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 50

    /** Only this Hub room; absent or null reads every room (the Office room). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(OFFICE_ROOM_KEYS)
    @MaxLength(20)
    room: string | null = null
}
