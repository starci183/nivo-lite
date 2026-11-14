import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { ArrayMaxSize, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

/** The statuses a page may ask for. */
const STATUSES = ["active", "proposed", "scheduled", "superseded", "rejected", "expired"] as const

/** The subject types a page may filter on. */
const SUBJECT_TYPES = ["business", "product", "service", "policy", "customer", "person", "supplier", "place", "other"] as const

@InputType()
/**
 * Which page of the Second Brain's facts to read (BRAIN-LIMITS item 4). Every field is optional: with none, the first page of 2,000
 * facts in force, waiting or scheduled, newest change first, exactly what `brain { facts }` answered before paging existed.
 */
export class BrainFactsPageInput {
    /** At most this many facts (1 to 2,000; default 2,000). */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(2000)
    first?: number

    /** The `factsNextCursor` of the page before; absent for the first page. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    after?: string

    /** Only these statuses (default: active, proposed, scheduled). */
    @Field(() => [String], { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @ArrayMaxSize(6)
    @IsIn(STATUSES, { each: true })
    statuses?: Array<(typeof STATUSES)[number]>

    /** Only facts whose evidence cites this document. */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    sourceId?: string

    /** Only facts of this kind of subject. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(SUBJECT_TYPES)
    subjectType?: (typeof SUBJECT_TYPES)[number]

    /** Only facts whose subject, attribute or value hold every word (accents ignored). */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    search?: string
}
