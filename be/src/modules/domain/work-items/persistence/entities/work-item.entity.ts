import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type {
    DecidedPath,
    EvidenceState,
    ReasonCode,
    StoredProposal,
    SubjectType,
    WorkResult,
    WorkStatus,
} from "../../work-items.contracts"

@Entity({ schema: "public", name: "work_items" })
/** One step of work in a workspace: the unit the agents queue, perform, hold for a person and close. */
export class WorkItemEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module that performs it. */
    @Column({ name: "department", type: "text" })
    department!: string

    /** The action key. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** What kind of record it is about; constrained by a CHECK. */
    @Column({ name: "subject_type", type: "text" })
    subjectType!: SubjectType

    /** The record it is about. */
    @Column({ name: "subject_id", type: "uuid", nullable: true })
    subjectId!: string | null

    /** The customer. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The input that started it. */
    @Column({ name: "inbound_event_id", type: "uuid", nullable: true })
    inboundEventId!: string | null

    /** The item that asked for it. */
    @Column({ name: "parent_id", type: "uuid", nullable: true })
    parentId!: string | null

    /** The key that makes an insert idempotent per workspace. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** Where the step stands. */
    @Column({ name: "status", type: "text", default: () => "'queued'" })
    status!: WorkStatus

    /** How it was decided; constrained by a CHECK. */
    @Column({ name: "decided_path", type: "text", nullable: true })
    decidedPath!: DecidedPath | null

    /** Why it needs a person; constrained by a CHECK. */
    @Column({ name: "reason", type: "text", nullable: true })
    reason!: ReasonCode | null

    /** Every reason. */
    @Column({ name: "reasons", type: "text", array: true, default: () => "'{}'::text[]" })
    reasons!: Array<string>

    /** Required fields still missing. */
    @Column({ name: "missing_fields", type: "text", array: true, default: () => "'{}'::text[]" })
    missingFields!: Array<string>

    /** The proposal; a legacy row may hold an empty object. */
    @Column({ name: "proposal", type: "jsonb", default: () => "'{}'::jsonb" })
    proposal!: StoredProposal

    /** What the performer reported. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: WorkResult | null

    /** The failure. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** How far the evidence got. */
    @Column({ name: "evidence_state", type: "text", default: () => "'pending'" })
    evidenceState!: EvidenceState

    /** The staff member it is assigned to. */
    @Column({ name: "assigned_staff_id", type: "uuid", nullable: true })
    assignedStaffId!: string | null

    /** The approval execution. */
    @Column({ name: "execution_id", type: "uuid", nullable: true })
    executionId!: string | null

    /** When the row was written. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When the row last changed; also the lease of a claimed item. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date

    /** When the work finished. */
    @Column({ name: "completed_at", type: "timestamptz", nullable: true })
    completedAt!: Date | null

    /** The root of its command chain. */
    @Column({ name: "chain_id", type: "uuid", nullable: true })
    chainId!: string | null

    /** Hops from the root. */
    @Column({ name: "depth", type: "int", default: () => "0" })
    depth!: number

    /** The agent instance. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null
}
