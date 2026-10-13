import { Field, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsInt, IsOptional, Max, Min, ValidateNested } from "class-validator"
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
}
