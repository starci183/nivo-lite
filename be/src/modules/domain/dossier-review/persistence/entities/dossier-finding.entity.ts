import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { FindingEvidence } from "../../dossier-review.contracts"

@Entity({ schema: "public", name: "dossier_findings" })
/** One thing wrong with a dossier, backed by evidence: a row of public.dossier_findings. */
export class DossierFindingEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The dossier it is filed under; null for a finding about the workspace as a whole. */
    @Column({ name: "dossier_id", type: "uuid", nullable: true })
    dossierId!: string | null

    /** The other dossiers it touches. */
    @Column({ name: "related_dossier_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    relatedDossierIds!: Array<string>

    /** What is wrong; the table checks it. */
    @Column({ name: "kind", type: "text" })
    kind!: "contradiction" | "missing" | "expired" | "unsigned" | "outdated" | "unreasonable"

    /** How much it matters; the table checks it. */
    @Column({ name: "severity", type: "text" })
    severity!: "critical" | "high" | "medium" | "low"

    /** rule or ai. */
    @Column({ name: "origin", type: "text" })
    origin!: "rule" | "ai"

    /** The rule that produced it, or `ai`. */
    @Column({ name: "rule_key", type: "text" })
    ruleKey!: string

    /** Its identity within the workspace: a re-run updates the same row. */
    @Column({ name: "fingerprint", type: "text" })
    fingerprint!: string

    /** The message code of a rule finding. */
    @Column({ name: "code", type: "text", nullable: true })
    code!: string | null

    /** The string params of the message code. */
    @Column({ name: "params", type: "jsonb", default: () => "'{}'::jsonb" })
    params!: Record<string, string>

    /** The title people read (Vietnamese for a rule finding; the API renders the request locale). */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The detail people read. */
    @Column({ name: "detail", type: "text" })
    detail!: string

    /** One to eight evidence items. */
    @Column({ name: "evidence", type: "jsonb" })
    evidence!: Array<FindingEvidence>

    /** What the evidence was: a dismissed finding re-detected with other evidence reopens. */
    @Column({ name: "evidence_hash", type: "text" })
    evidenceHash!: string

    /** The sources the evidence cites, repeated for the index. */
    @Column({ name: "source_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    sourceIds!: Array<string>

    /** The facts the evidence cites, repeated for the index. */
    @Column({ name: "fact_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    factIds!: Array<string>

    /** What completes it: upload, draft, decide or external. */
    @Column({ name: "remedy_action", type: "text" })
    remedyAction!: "upload" | "draft" | "decide" | "external"

    /** The kind of document that completes it. */
    @Column({ name: "remedy_document_type", type: "text", nullable: true })
    remedyDocumentType!: string | null

    /** Where it stands in its lifecycle. */
    @Column({ name: "status", type: "text", default: () => "'open'::text" })
    status!: "open" | "confirmed" | "dismissed" | "resolved"

    /** Why it is resolved; set exactly when the status is resolved. */
    @Column({ name: "resolution", type: "text", nullable: true })
    resolution!: "document" | "draft" | "not_detected" | "manual" | null

    /** Why the owner dismissed it. */
    @Column({ name: "dismiss_reason", type: "text", nullable: true })
    dismissReason!: string | null

    /** The evidence hash at the time it was dismissed. */
    @Column({ name: "dismissed_evidence_hash", type: "text", nullable: true })
    dismissedEvidenceHash!: string | null

    /** How many times it came back after being dismissed or resolved. */
    @Column({ name: "reopened_count", type: "smallint", default: () => "0" })
    reopenedCount!: number

    /** The user who made the last decision. */
    @Column({ name: "decided_by", type: "uuid", nullable: true })
    decidedBy!: string | null

    /** When the last decision was made. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** The note given with the last decision. */
    @Column({ name: "decision_note", type: "text", nullable: true })
    decisionNote!: string | null

    /** The member who owns it. */
    @Column({ name: "assignee_id", type: "uuid", nullable: true })
    assigneeId!: string | null

    /** When it should be done, as a date. */
    @Column({ name: "due_at", type: "date", nullable: true })
    dueAt!: string | null

    /** The run that found it first. */
    @Column({ name: "first_seen_run_id", type: "uuid", nullable: true })
    firstSeenRunId!: string | null

    /** The run that last saw it. */
    @Column({ name: "last_seen_run_id", type: "uuid", nullable: true })
    lastSeenRunId!: string | null

    /** When it was first seen. */
    @Column({ name: "first_seen_at", type: "timestamptz" })
    firstSeenAt!: Date

    /** When it was last seen. */
    @Column({ name: "last_seen_at", type: "timestamptz" })
    lastSeenAt!: Date

    /** When it was resolved. */
    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null
}
