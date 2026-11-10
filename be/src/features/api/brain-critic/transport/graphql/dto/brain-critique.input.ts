import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { ANSWER_KINDS, type AnswerKind, type PointState } from "@modules/domain/dossier-review"
import { NullAsAbsent } from "@modules/platform/graphql"

const POINT_STATES: ReadonlyArray<PointState> = ["open", "answered", "skipped", "gone"]

@InputType()
/** Which document, and which of its points. */
export class BrainCritiqueInput {
    /** The document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    sourceId!: string

    /** open, answered, skipped, gone; default open. */
    @Field(() => [String], { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(4)
    @IsIn([...POINT_STATES], { each: true })
    states?: Array<PointState>
}

@InputType()
/** A typed answer about the point's own facts. */
export class BrainCritiqueAnswerInput {
    /** pick, value, keep_document, keep_shop, split or remove. */
    @Field(() => String)
    @IsIn([...ANSWER_KINDS])
    @MaxLength(20)
    kind!: AnswerKind

    /** The fact (one the point cites). */
    @Field(() => ID, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsUUID()
    @MaxLength(36)
    factId?: string

    /** The value. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    value?: string

    /** The condition of a split. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(200)
    situation?: string
}

@InputType()
/** The founder's answer to one point: a choice of it, or a typed answer. */
export class AnswerBrainCritiqueInput {
    /** The point. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string

    /** "a" or "b". */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(["a", "b"])
    choiceId?: "a" | "b"

    /** The typed value of a choice that needs one. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    value?: string

    /** A typed answer instead of a choice. */
    @Field(() => BrainCritiqueAnswerInput, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @ValidateNested()
    @Type(() => BrainCritiqueAnswerInput)
    answer?: BrainCritiqueAnswerInput

    /** A note. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string
}

@InputType()
/** Skipping one point. */
export class SkipBrainCritiqueInput {
    /** The point. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    findingId!: string

    /** Why. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string
}

@InputType()
/** One document. */
export class BrainCritiqueSourceInput {
    /** The document. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    sourceId!: string
}
