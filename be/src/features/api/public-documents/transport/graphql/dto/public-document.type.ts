import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { PublicDocumentSourceType } from "./public-document-source.type"
import { PublicLeftOutType } from "./public-left-out.type"

@ObjectType()
/** A document written for customers, apart from the internal documents it was drafted from. */
export class PublicDocumentType {
    /** The document. */
    @Field(() => ID)
    id!: string

    /** The title. */
    @Field(() => String)
    title!: string

    /** The text being worked on. */
    @Field(() => String)
    body!: string

    /** The exact current content revision to pass when approving this text. */
    @Field(() => Int)
    draftRevision!: number

    /** The approved text customers read now, or null while nothing is published. */
    @Field(() => String, { nullable: true })
    publishedBody!: string | null

    /** `drafting`, `draft`, `published`, `archived` or `failed`. */
    @Field(() => String)
    status!: string

    /** `drafted`, `written` or `answer`. */
    @Field(() => String)
    kind!: string

    /** The customer question this answers, when it is a proposal. */
    @Field(() => String, { nullable: true })
    question!: string | null

    /** The unanswered customer question it proposes to answer. */
    @Field(() => ID, { nullable: true })
    gapId!: string | null

    /** The internal documents it was drafted from. */
    @Field(() => [PublicDocumentSourceType])
    sources!: Array<PublicDocumentSourceType>

    /** What NIVO left out of the draft. */
    @Field(() => [PublicLeftOutType])
    leftOut!: Array<PublicLeftOutType>

    /** True when an internal source changed since the owner approved. */
    @Field(() => Boolean)
    needsReview!: boolean

    /** True when the document is published and the text being worked on differs from the published one. */
    @Field(() => Boolean)
    hasPendingChange!: boolean

    /** Who approved it. */
    @Field(() => String, { nullable: true })
    approvedByName!: string | null

    /** When it was approved, ISO 8601. */
    @Field(() => String, { nullable: true })
    approvedAt!: string | null

    /** The stored code of why drafting stopped. */
    @Field(() => String, { nullable: true })
    failureCode!: string | null

    /** When it was made, ISO 8601. */
    @Field(() => String)
    createdAt!: string

    /** When it last changed, ISO 8601. */
    @Field(() => String)
    updatedAt!: string
}
