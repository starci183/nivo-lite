import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import type { RelationKind } from "@modules/domain/brain-facts"
import { RELATION_KINDS } from "@modules/domain/brain-facts"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** An edge to draw between two truths. */
export class LinkBrainFactsInput {
    /** The truth the edge starts from. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    fromFactId!: string

    /** The truth it points at. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    toFactId!: string

    /** `part_of`, `applies_to`, `depends_on`, `exception_of` or `related`. */
    @Field(() => String)
    @IsIn([...RELATION_KINDS])
    @MaxLength(40)
    kind!: RelationKind

    /** The relation in the owner's words ("giao bang"). */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(80)
    label?: string
}
