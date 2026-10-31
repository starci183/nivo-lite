import { Field, ID, InputType, Int } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    IsArray,
    IsBoolean,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
} from "class-validator"
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@modules/platform/pagination"

@InputType()
/** Selects a bounded page of the findings of the workspace. */
export class DossierFindingsInput {
    /** The requested page size, from one through the shared maximum. */
    @Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE_SIZE })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(MAX_PAGE_SIZE)
    first: number | null = DEFAULT_PAGE_SIZE

    /** The opaque cursor returned by the preceding page, or null for the first page. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(2048)
    after: string | null = null

    /** Only the findings of this dossier. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    dossierId: string | null = null

    /** Only these statuses. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(4)
    @IsIn(["open", "confirmed", "dismissed", "resolved"], { each: true })
    statuses: Array<string> | null = null

    /** Only these severities. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(4)
    @IsIn(["critical", "high", "medium", "low"], { each: true })
    severities: Array<string> | null = null

    /** Only the findings assigned to this member. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    assigneeId: string | null = null

    /** True keeps only the findings nobody owns. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    unassigned: boolean | null = null

    /** True keeps only the findings with a draft waiting for approval. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @IsBoolean()
    draftsAwaiting: boolean | null = null
}
