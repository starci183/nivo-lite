import { Transform, Type } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsISO8601,
    IsOptional,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"

/** The position after which a page of work items starts. */
export class WorkItemCursorRequest {
    /** The `created_at` of the last item of the previous page. */
    @IsISO8601({ strict: true })
    @MaxLength(40)
    createdAt!: string

    /** The id of the last item of the previous page. */
    @IsUUID("4")
    @MaxLength(36)
    id!: string
}

const asList = ({ value }: TransformFnParams): unknown => (typeof value === "string" ? [value] : value)

/** The bounded query string of the work item listing. */
export class ListWorkItemsRequest {
    /** Only these statuses; empty means every status. */
    @IsOptional()
    @Transform(asList)
    @IsArray()
    @ArrayMaxSize(5)
    @IsIn(["queued", "done", "waiting_decision", "rejected", "failed"], { each: true })
    statuses: Array<"queued" | "done" | "waiting_decision" | "rejected" | "failed"> = []

    /** Where the page starts: the `next` cursor of the previous page, sent as `after[createdAt]` and `after[id]`. */
    @IsOptional()
    @ValidateNested()
    @Type(() => WorkItemCursorRequest)
    after?: WorkItemCursorRequest

    /** The page size, 1 to 100; 50 when absent. */
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 50
}
