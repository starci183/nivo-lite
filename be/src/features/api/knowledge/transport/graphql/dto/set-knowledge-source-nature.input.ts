import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"
import { PART_NATURES, type PartNature } from "@modules/domain/brain"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** What the founder says a document is. */
export class SetKnowledgeSourceNatureInput {
    /** The document (any of its parts). */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    sourceId!: string

    /** `rules`, `records`, `log` or `reference`; omitted (or null) takes the founder's answer back and the model's reading stands. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn([...PART_NATURES])
    @MaxLength(16)
    nature?: PartNature
}
