import { Field, ID, ObjectType } from "@nestjs/graphql"
import { HiringOfferTermsType } from "./hiring-offer-terms.type"

@ObjectType()
/** One offer of the workbench. */
export class HiringOfferType {
    /** The offer id. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The candidate. */
    @Field(() => ID)
    candidateId!: string

    /** The job. */
    @Field(() => ID)
    jobId!: string

    /** The terms. */
    @Field(() => HiringOfferTermsType)
    terms!: HiringOfferTermsType

    /** The letter text. */
    @Field(() => String)
    draft!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** The token in the candidate's link. */
    @Field(() => String)
    token!: string

    /** The decision that carries the owner's approval. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** When the offer lapses. */
    @Field(() => String, { nullable: true })
    expiresAt!: string | null

    /** How it was sent. */
    @Field(() => String, { nullable: true })
    sentVia!: string | null

    /** When it was sent. */
    @Field(() => String, { nullable: true })
    sentAt!: string | null

    /** When the candidate answered. */
    @Field(() => String, { nullable: true })
    respondedAt!: string | null

    /** When it was created. */
    @Field(() => String)
    createdAt!: string
}
