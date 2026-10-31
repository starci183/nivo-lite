import { Field, Int, ObjectType } from "@nestjs/graphql"
import { DossierReviewRunType } from "./dossier-review-run.type"
import { DossierReviewType } from "./dossier-review.type"

@ObjectType()
/** The state of the dossier review of a workspace. */
export class DossierReviewSummaryType {
    /** Open findings. */
    @Field(() => Int)
    open!: number

    /** Confirmed findings. */
    @Field(() => Int)
    confirmed!: number

    /** Active critical findings. */
    @Field(() => Int)
    critical!: number

    /** Active high findings. */
    @Field(() => Int)
    high!: number

    /** Drafts waiting for approval. */
    @Field(() => Int)
    draftsAwaiting!: number

    /** Whether a run is queued or running. */
    @Field(() => Boolean)
    isRunning!: boolean

    /** The latest run, or null. */
    @Field(() => DossierReviewRunType, { nullable: true })
    latestRun?: DossierReviewRunType | null

    /** The computed status per reviewed dossier. */
    @Field(() => [DossierReviewType])
    dossiers!: ReadonlyArray<DossierReviewType>
}
