import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { LeftOut, PublicDocumentKind, PublicDocumentStatus } from "../../public-documents.contracts"

@Entity({ schema: "public", name: "public_documents" })
/** One document written for customers: its own text, approved by a person, apart from the internal documents it was drafted from. */
export class PublicDocumentEntity extends UuidAbstractEntity {
    /** The owning workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The text being worked on. */
    @Column({ name: "body", type: "text", default: () => "''::text" })
    body!: string

    /** The approved text customers read now; null until the first approval. */
    @Column({ name: "published_body", type: "text", nullable: true })
    publishedBody!: string | null

    /** The immutable approval revision currently served; null until first approval. */
    @Column({ name: "published_revision", type: "integer", nullable: true })
    publishedRevision!: number | null

    /** drafted, written or answer. */
    @Column({ name: "kind", type: "text", default: () => "'written'::text" })
    kind!: PublicDocumentKind

    /** drafting, draft, published, archived or failed. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: PublicDocumentStatus

    /** The queued drafting attempt; an older worker cannot write or fail a later redraft. */
    @Column({ name: "draft_revision", type: "integer", default: 0 })
    draftRevision!: number

    /** The customer question this answers. */
    @Column({ name: "question", type: "text", nullable: true })
    question!: string | null

    /** The unanswered question it proposes to answer; one proposal per question. */
    @Column({ name: "gap_id", type: "uuid", nullable: true })
    gapId!: string | null

    /** The owner's note to NIVO for the draft. */
    @Column({ name: "instructions", type: "text", nullable: true })
    instructions!: string | null

    /** What NIVO left out of the draft. */
    @Column({ name: "left_out", type: "jsonb", default: () => "'[]'::jsonb" })
    leftOut!: Array<LeftOut>

    /** The stored code of why drafting failed. */
    @Column({ name: "failure_code", type: "text", nullable: true })
    failureCode!: string | null

    /** The person who approved the published text. */
    @Column({ name: "approved_by", type: "uuid", nullable: true })
    approvedBy!: string | null

    /** The name the workspace showed for the approver at that time. */
    @Column({ name: "approved_by_name", type: "text", nullable: true })
    approvedByName!: string | null

    /** When it was approved. */
    @Column({ name: "approved_at", type: "timestamptz", nullable: true })
    approvedAt!: Date | null

    /** The public knowledge source customers read it from. */
    @Column({ name: "published_source_id", type: "uuid", nullable: true })
    publishedSourceId!: string | null

    /** Who asked for it. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null
}
