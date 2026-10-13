import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a setup answer writes: a Second Brain fact or one field of an authority rule. */
export class ModuleGateWriteType {
    /** `fact` or `rule`. */
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

    /** For a rule: the authority action. */
    @Field(() => String, { nullable: true })
    action?: string | null

    /** For a rule: the field the answer sets. */
    @Field(() => String, { nullable: true })
    field?: string | null
}
