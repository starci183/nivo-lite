import { Field, ID, ObjectType } from "@nestjs/graphql"
import { DossierDraftPlaceholderType } from "./dossier-draft-placeholder.type"

@ObjectType()
/** A document NIVO drafted to complete a finding, for the owner to approve. */
export class DossierRemedyDraftType {
    /** The draft id. */
    @Field(() => ID)
    id!: string

    /** The finding it answers. */
    @Field(() => ID)
    findingId!: string

    /** The dossier, or null. */
    @Field(() => ID, { nullable: true })
    dossierId?: string | null

    /** generating, proposed, approved, rejected or failed. */
    @Field(() => String)
    status!: string

    /** The title. */
    @Field(() => String)
    title!: string

    /** The kind of document. */
    @Field(() => String)
    documentType!: string

    /** The Markdown body. */
    @Field(() => String)
    body!: string

    /** The blanks left to fill in. */
    @Field(() => [DossierDraftPlaceholderType])
    placeholders!: ReadonlyArray<DossierDraftPlaceholderType>

    /** Why drafting failed, or null. */
    @Field(() => String, { nullable: true })
    error?: string | null

    /** The document an approval created, or null. */
    @Field(() => ID, { nullable: true })
    sourceId?: string | null

    /** The owner's notes, or null. */
    @Field(() => String, { nullable: true })
    instructions?: string | null

    /** Why it was rejected, or null. */
    @Field(() => String, { nullable: true })
    rejectReason?: string | null

    /** When it was decided, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    decidedAt?: string | null

    /** When it was requested, ISO 8601. */
    @Field(() => String)
    createdAt!: string

    /** When it was last changed, ISO 8601. */
    @Field(() => String)
    updatedAt!: string
}
