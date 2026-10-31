import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "dossier_reviews" })
/** What the last review computed for one dossier: a row of public.dossier_reviews. */
export class DossierReviewEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The dossier, unique. */
    @Column({ name: "dossier_id", type: "uuid" })
    dossierId!: string

    /** The recomputed status; the table checks it. */
    @Column({ name: "status", type: "text" })
    status!: "present" | "partial" | "drafted" | "missing" | "template"

    /** How many findings are active. */
    @Column({ name: "open_count", type: "integer", default: () => "0" })
    openCount!: number

    /** How many active findings are critical. */
    @Column({ name: "critical_count", type: "integer", default: () => "0" })
    criticalCount!: number

    /** How many active findings are high. */
    @Column({ name: "high_count", type: "integer", default: () => "0" })
    highCount!: number

    /** How many actual documents the dossier held. */
    @Column({ name: "actual_documents", type: "integer", default: () => "0" })
    actualDocuments!: number

    /** How many drafts it held. */
    @Column({ name: "draft_documents", type: "integer", default: () => "0" })
    draftDocuments!: number

    /** How many templates it held. */
    @Column({ name: "template_documents", type: "integer", default: () => "0" })
    templateDocuments!: number

    /** What the model pass last read; an unchanged fingerprint skips the model. */
    @Column({ name: "inputs_fingerprint", type: "text", nullable: true })
    inputsFingerprint!: string | null

    /** The run that wrote the row. */
    @Column({ name: "last_run_id", type: "uuid", nullable: true })
    lastRunId!: string | null

    /** When the dossier was reviewed. */
    @Column({ name: "reviewed_at", type: "timestamptz" })
    reviewedAt!: Date
}
