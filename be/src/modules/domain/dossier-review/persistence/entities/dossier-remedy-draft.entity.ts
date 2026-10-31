import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** A value the draft leaves for the owner to fill in. */
export interface DraftPlaceholder {
    /** What the value is. */
    readonly label: string
    /** Why the model could not fill it. */
    readonly reason: string
}

@Entity({ schema: "public", name: "dossier_remedy_drafts" })
/** A document NIVO drafted for a finding, waiting for the owner: a row of public.dossier_remedy_drafts. */
export class DossierRemedyDraftEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The finding it answers. */
    @Column({ name: "finding_id", type: "uuid" })
    findingId!: string

    /** The dossier of that finding. */
    @Column({ name: "dossier_id", type: "uuid", nullable: true })
    dossierId!: string | null

    /** Where it stands; the table checks it. */
    @Column({ name: "status", type: "text", default: () => "'generating'::text" })
    status!: "generating" | "proposed" | "approved" | "rejected" | "failed"

    /** What the owner asked NIVO to take care of. */
    @Column({ name: "instructions", type: "text", nullable: true })
    instructions!: string | null

    /** The title of the document. */
    @Column({ name: "title", type: "text", default: () => "''::text" })
    title!: string

    /** The kind of document. */
    @Column({ name: "document_type", type: "text", default: () => "''::text" })
    documentType!: string

    /** The Markdown text. */
    @Column({ name: "body", type: "text", default: () => "''::text" })
    body!: string

    /** The values left to fill in. */
    @Column({ name: "placeholders", type: "jsonb", default: () => "'[]'::jsonb" })
    placeholders!: Array<DraftPlaceholder>

    /** The model that wrote it. */
    @Column({ name: "model", type: "text", nullable: true })
    model!: string | null

    /** The error code of a failed draft. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The knowledge source an approved draft became. */
    @Column({ name: "source_id", type: "uuid", nullable: true })
    sourceId!: string | null

    /** The user who asked for it. */
    @Column({ name: "requested_by", type: "uuid" })
    requestedBy!: string

    /** The user who approved or rejected it. */
    @Column({ name: "decided_by", type: "uuid", nullable: true })
    decidedBy!: string | null

    /** When it was approved or rejected. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** Why it was rejected. */
    @Column({ name: "reject_reason", type: "text", nullable: true })
    rejectReason!: string | null
}
