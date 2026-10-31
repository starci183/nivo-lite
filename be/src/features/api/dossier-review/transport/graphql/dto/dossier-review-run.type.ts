import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One requested review run. */
export class DossierReviewRunType {
    /** The run id. */
    @Field(() => ID)
    id!: string

    /** dossier or workspace. */
    @Field(() => String)
    scope!: string

    /** The dossier of a dossier run, or null. */
    @Field(() => ID, { nullable: true })
    dossierId?: string | null

    /** document, document_gone or request. */
    @Field(() => String)
    trigger!: string

    /** queued, running, done or failed. */
    @Field(() => String)
    status!: string

    /** How the AI pass went, or null while it has not run. */
    @Field(() => String, { nullable: true })
    aiState?: string | null

    /** Findings the run opened. */
    @Field(() => Int)
    opened!: number

    /** Findings the run resolved. */
    @Field(() => Int)
    resolved!: number

    /** Candidates dropped for lack of evidence. */
    @Field(() => Int)
    dropped!: number

    /** When it started, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    startedAt?: string | null

    /** When it ended, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    finishedAt?: string | null

    /** When it was requested, ISO 8601. */
    @Field(() => String)
    createdAt!: string
}
