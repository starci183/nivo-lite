import { Field, InputType, Int } from "@nestjs/graphql"
import { NullAsAbsent } from "@modules/platform/graphql"
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The decision of the owner on one confirm card, with the edits. */
export class CardDecisionInput {
    /** Confirm (optionally edited) or reject. */
    @Field()
    @IsIn(["confirm", "reject"])
    decision!: "confirm" | "reject"

    /** Fact edit: the value. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(2000)
    value?: string

    /** Fact edit: the subject. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(160)
    subjectLabel?: string

    /** Fact edit: the attribute. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(120)
    attributeLabel?: string

    /** The situation the new value is for, when both values are kept. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(200)
    situation?: string

    /** Fact edit: who may read it. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsIn(["public", "internal", "restricted"])
    scope?: "public" | "internal" | "restricted"

    /** Rule edit: the limit, VND; null for none. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    limitVnd?: number | null

    /** Rule edit: the mode. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsIn(["auto", "ask", "never"])
    mode?: "auto" | "ask" | "never"

    /** What to do with a value already in force. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsIn(["replace", "keep", "both"])
    resolution?: "replace" | "keep" | "both"

    /** The fact is for THIS instance only instead of every instance of the type. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsBoolean()
    onlyThisAgent?: boolean

    /** Branch edit: the band the exact boundary amount belongs to, lower or higher. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsIn(["lower", "higher"])
    belongsTo?: "lower" | "higher"

    /** Branch edit: the seat asked above the line. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsString()
    @MaxLength(36)
    approverMemberId?: string
}
