import { Column, Entity, PrimaryColumn } from "typeorm"
import type { SourceRecordRef, ReviewedSourceRef } from "../../public-documents.contracts"

@Entity({ schema: "public", name: "public_document_approvals" })
/** An immutable approval of exact content and provenance; the application role can insert and read, never update or delete it. */
export class PublicDocumentApprovalEntity {
    /** The document whose content was reviewed. */
    @PrimaryColumn({ name: "document_id", type: "uuid" })
    documentId!: string

    /** The exact content revision reviewed and approved. */
    @PrimaryColumn({ name: "draft_revision", type: "integer" })
    draftRevision!: number

    /** The workspace that owns the approval. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The approved title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The approved body, preserved after later edits or redrafts. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** The internal source versions from which this draft was written. */
    @Column({ name: "draft_sources", type: "jsonb", default: () => "'[]'::jsonb" })
    draftSources!: ReadonlyArray<SourceRecordRef>

    /** The current internal source versions recorded by the approval transaction. */
    @Column({ name: "reviewed_sources", type: "jsonb", default: () => "'[]'::jsonb" })
    reviewedSources!: ReadonlyArray<ReviewedSourceRef>

    /** The authenticated user principal who approved this revision. */
    @Column({ name: "approved_by", type: "uuid" })
    approvedBy!: string

    /** The approver's display name at that time; identity is the principal above. */
    @Column({ name: "approved_by_name", type: "text", nullable: true })
    approvedByName!: string | null

    /** The approval timestamp recorded in the publication transaction. */
    @Column({ name: "approved_at", type: "timestamptz" })
    approvedAt!: Date
}
