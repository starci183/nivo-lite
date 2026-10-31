import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** What a run holds once it ended: the counts the owner sees and the work the model did. */
export interface DossierRunStats {
    /** How many findings the run opened. */
    readonly opened?: number
    /** How many findings the run resolved. */
    readonly resolved?: number
    /** How many candidates the evidence check dropped. */
    readonly dropped?: number
    /** Why candidates were dropped, by reason. */
    readonly droppedReasons?: Readonly<Record<string, number>>
    /** How many dossiers were evaluated by the rules. */
    readonly evaluated?: number
    /** How many model calls the run made. */
    readonly aiCalls?: number
    /** The prompt tokens those calls used. */
    readonly promptTokens?: number
}

@Entity({ schema: "public", name: "dossier_review_runs" })
/** One requested review of a dossier or of the whole set: a row of public.dossier_review_runs. */
export class DossierReviewRunEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** dossier or workspace; the table checks it against `dossier_id`. */
    @Column({ name: "scope", type: "text" })
    scope!: "dossier" | "workspace"

    /** The dossier of a dossier run; null for a workspace run. */
    @Column({ name: "dossier_id", type: "uuid", nullable: true })
    dossierId!: string | null

    /** What asked for the run. */
    @Column({ name: "trigger", type: "text" })
    trigger!: "document" | "document_gone" | "request"

    /** The source behind a document trigger. */
    @Column({ name: "trigger_ref", type: "uuid", nullable: true })
    triggerRef!: string | null

    /** Where the run stands. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: "queued" | "running" | "done" | "failed"

    /** The user who pressed the button, when one did. */
    @Column({ name: "requested_by", type: "uuid", nullable: true })
    requestedBy!: string | null

    /** What the model pass did, once the run ended. */
    @Column({ name: "ai_state", type: "text", nullable: true })
    aiState!: "done" | "partial" | "skipped_unchanged" | "skipped_credits" | "skipped_budget" | "failed" | null

    /** The counts of the run. */
    @Column({ name: "stats", type: "jsonb", default: () => "'{}'::jsonb" })
    stats!: DossierRunStats

    /** The error code of a failed run. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** When a worker claimed the run. */
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null

    /** When the run ended. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
