import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One piece of evidence of a finding: where it comes from and what it says. */
export class DossierFindingEvidenceType {
    /** claim, counter, expected, event or context. */
    @Field(() => String)
    role!: string

    /** What it is. */
    @Field(() => String)
    label!: string

    /** The document it comes from. */
    @Field(() => ID, { nullable: true })
    sourceId?: string | null

    /** The title of that document. */
    @Field(() => String, { nullable: true })
    sourceTitle?: string | null

    /** The passage it comes from. */
    @Field(() => ID, { nullable: true })
    passageId?: string | null

    /** The fact it comes from. */
    @Field(() => ID, { nullable: true })
    factId?: string | null

    /** The fact as one line. */
    @Field(() => String, { nullable: true })
    factLine?: string | null

    /** The words quoted. */
    @Field(() => String, { nullable: true })
    quote?: string | null
}
