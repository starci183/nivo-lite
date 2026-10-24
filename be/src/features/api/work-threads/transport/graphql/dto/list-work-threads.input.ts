import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@modules/platform/pagination"

@InputType()
/** The bounded arguments of the thread list. */
export class ListWorkThreadsInput {
    /** The requested page size, from one through the shared maximum. */
    @Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE_SIZE })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    first: number | null = DEFAULT_PAGE_SIZE

    /** The opaque cursor returned by the preceding page, or null for the newest page. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    after: string | null = null

    /** Only threads about this lead; absent or null lists every thread of the workspace. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    leadId: string | null = null
}
