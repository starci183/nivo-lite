import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a setup answer writes: a Second Brain fact. */
export class ModuleGateWriteType {
    /** Always `fact`. */
    @Field()
    kind!: string

    /** For a fact: what it is about. */
    @Field(() => String, { nullable: true })
    subjectType?: string | null

    /** For a fact: the label of the attribute it states. */
    @Field(() => String, { nullable: true })
    attributeLabel?: string | null

    /** For a fact: who may read it. */
    @Field(() => String, { nullable: true })
    scope?: string | null

    /** Always null: rule writes are gone with the authority rules (2026-11-13); the web still selects it. */
    @Field(() => String, { nullable: true })
    action?: string | null

    /** Always null: rule writes are gone with the authority rules (2026-11-13); the web still selects it. */
    @Field(() => String, { nullable: true })
    field?: string | null
}
