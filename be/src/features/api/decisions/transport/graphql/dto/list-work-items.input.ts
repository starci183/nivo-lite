import { Field, InputType, Int } from "@nestjs/graphql"
import { Transform, Type } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"
import { WorkItemCursorInput } from "./work-item-cursor.input"

@InputType()
/** The bounded arguments of the work item listing. */
export class ListWorkItemsInput {
    /** Only these statuses; empty means every status. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(5)
    @IsIn(["queued", "done", "waiting_decision", "rejected", "failed"], { each: true })
    statuses: Array<"queued" | "done" | "waiting_decision" | "rejected" | "failed"> = []

    /** Only this action; absent means every action. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MaxLength(80)
    action?: string

    /** Where the page starts: the `next` cursor of the previous page. */
    @Field(() => WorkItemCursorInput, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @ValidateNested()
    @Type(() => WorkItemCursorInput)
    after?: WorkItemCursorInput

    /** The page size, 1 to 100; 50 when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit: number = 50
}
