import { Type } from "class-transformer"
import { IsInt, IsISO8601, IsOptional, IsUUID, Max, MaxLength, Min, ValidateNested } from "class-validator"

/** The position before which a page of the thread starts. */
export class ThreadCursorRequest {
    /** The `created_at` of the oldest message of the previous page. */
    @IsISO8601({ strict: true })
    @MaxLength(40)
    createdAt!: string

    /** The id of the oldest message of the previous page. */
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}

/** The bounded query string of the thread listing. */
export class ListThreadMessagesRequest {
    /** Where the page starts: the `next` cursor of the previous page, sent as `before[createdAt]` and `before[id]`. */
    @IsOptional()
    @ValidateNested()
    @Type(() => ThreadCursorRequest)
    before: ThreadCursorRequest | null = null

    /** The page size, 1 to 100; 50 when absent. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 50
}
