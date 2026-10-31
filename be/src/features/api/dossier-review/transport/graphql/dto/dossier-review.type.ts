import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The status a review computed for one dossier. */
export class DossierReviewType {
    /** The dossier. */
    @Field(() => ID)
    dossierId!: string

    /** present, partial, drafted, missing or template. */
    @Field(() => String)
    status!: string

    /** The status the imported checklist gives it. */
    @Field(() => String)
    checklistStatus!: string

    /** Active findings. */
    @Field(() => Int)
    openCount!: number

    /** Active critical findings. */
    @Field(() => Int)
    criticalCount!: number

    /** Active high findings. */
    @Field(() => Int)
    highCount!: number

    /** When it was reviewed, ISO 8601. */
    @Field(() => String)
    reviewedAt!: string
}
