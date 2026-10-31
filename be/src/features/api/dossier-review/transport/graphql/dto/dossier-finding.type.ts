import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { DossierFindingEvidenceType } from "./dossier-finding-evidence.type"
import { DossierFindingParamType } from "./dossier-finding-param.type"

@ObjectType()
/** One thing wrong with one dossier, with its evidence, owner and lifecycle. */
export class DossierFindingType {
    /** The finding id. */
    @Field(() => ID)
    id!: string

    /** The dossier it is filed under, or null for the whole set. */
    @Field(() => ID, { nullable: true })
    dossierId?: string | null

    /** The reference of that dossier. */
    @Field(() => String, { nullable: true })
    dossierRef?: string | null

    /** The name of that dossier. */
    @Field(() => String, { nullable: true })
    dossierName?: string | null

    /** The other dossiers it touches. */
    @Field(() => [ID])
    relatedDossierIds!: ReadonlyArray<string>

    /** contradiction, missing, expired, unsigned, outdated or unreasonable. */
    @Field(() => String)
    kind!: string

    /** critical, high, medium or low. */
    @Field(() => String)
    severity!: string

    /** rule or ai. */
    @Field(() => String)
    origin!: string

    /** The message code of a rule finding. */
    @Field(() => String, { nullable: true })
    code?: string | null

    /** The string parameters of the message. */
    @Field(() => [DossierFindingParamType])
    params!: ReadonlyArray<DossierFindingParamType>

    /** The title, in the request locale for a rule finding. */
    @Field(() => String)
    title!: string

    /** The detail, in the request locale for a rule finding. */
    @Field(() => String)
    detail!: string

    /** The evidence. */
    @Field(() => [DossierFindingEvidenceType])
    evidence!: ReadonlyArray<DossierFindingEvidenceType>

    /** upload, draft, decide or external. */
    @Field(() => String)
    remedyAction!: string

    /** The document that completes it, or null. */
    @Field(() => String, { nullable: true })
    remedyDocumentType?: string | null

    /** open, confirmed, dismissed or resolved. */
    @Field(() => String)
    status!: string

    /** How it was resolved, or null. */
    @Field(() => String, { nullable: true })
    resolution?: string | null

    /** Why it was dismissed, or null. */
    @Field(() => String, { nullable: true })
    dismissReason?: string | null

    /** The note of the last decision, or null. */
    @Field(() => String, { nullable: true })
    decisionNote?: string | null

    /** How many times new evidence reopened it. */
    @Field(() => Int)
    reopenedCount!: number

    /** The member who owns it, or null. */
    @Field(() => ID, { nullable: true })
    assigneeId?: string | null

    /** The due date, YYYY-MM-DD, or null. */
    @Field(() => String, { nullable: true })
    dueAt?: string | null

    /** The current draft, or null. */
    @Field(() => ID, { nullable: true })
    draftId?: string | null

    /** The status of that draft, or null. */
    @Field(() => String, { nullable: true })
    draftStatus?: string | null

    /** When it was first found, ISO 8601. */
    @Field(() => String)
    firstSeenAt!: string

    /** When it was last found, ISO 8601. */
    @Field(() => String)
    lastSeenAt!: string

    /** When it was resolved, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    resolvedAt?: string | null

    /** When the last decision was made, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    decidedAt?: string | null

    /** When the row was created, ISO 8601. */
    @Field(() => String)
    createdAt!: string

    /** When the row was last changed, ISO 8601. */
    @Field(() => String)
    updatedAt!: string
}
