import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_runs" })
/**
 * The durable run of one wake: its status, the trigger intact for a person, the park and resume bookkeeping, and the workflow version it
 * executes (written once, in the transaction that opens the run). One run per wake and planning flag; `version` fences every write.
 */
export class AgentRunEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The wake it answers. */
    @Column({ name: "wake_id", type: "uuid" })
    wakeId!: string

    /** The trigger step of the graph. */
    @Column({ name: "trigger", type: "text" })
    trigger!: string

    /** The published graph version it runs on, or null. */
    @Column({ name: "graph_version_id", type: "uuid", nullable: true })
    graphVersionId!: string | null

    /** Whether a plan is bound. */
    @Column({ name: "planning", type: "boolean", default: () => "false" })
    planning!: boolean

    /** Where it stands. */
    @Column({ name: "status", type: "text", default: () => "'running'" })
    status!: string

    /** `legacy` or `langgraph`. */
    @Column({ name: "engine", type: "text", default: () => "'langgraph'" })
    engine!: string

    /** The trigger, intact. */
    @Column({ name: "context", type: "jsonb" })
    context!: object

    /** Why it stopped, or null. */
    @Column({ name: "error", type: "jsonb", nullable: true })
    error!: object | null

    /** When a person was told, or null. */
    @Column({ name: "dead_lettered_at", type: "timestamptz", nullable: true })
    deadLetteredAt!: Date | null

    /** The build it parked under, or null. */
    @Column({ name: "parked_build", type: "text", nullable: true })
    parkedBuild!: string | null

    /** Why it parked, or null. */
    @Column({ name: "park_reason", type: "text", nullable: true })
    parkReason!: string | null

    /** The times the machine resumed it. */
    @Column({ name: "resume_attempts", type: "integer", default: () => "0" })
    resumeAttempts!: number

    /** The earliest the machine may resume it again, or null. */
    @Column({ name: "resume_not_before", type: "timestamptz", nullable: true })
    resumeNotBefore!: Date | null

    /** When it was last resumed, or null. */
    @Column({ name: "resumed_at", type: "timestamptz", nullable: true })
    resumedAt!: Date | null

    /** Who resumed it, or null. */
    @Column({ name: "resumed_by", type: "text", nullable: true })
    resumedBy!: string | null

    /** Why it was resumed, or null. */
    @Column({ name: "resume_reason", type: "text", nullable: true })
    resumeReason!: string | null

    /** The work item it waits on, or null. */
    @Column({ name: "wait_work_item_id", type: "uuid", nullable: true })
    waitWorkItemId!: string | null

    /** The deadline of that wait, or null. */
    @Column({ name: "wait_deadline_at", type: "timestamptz", nullable: true })
    waitDeadlineAt!: Date | null

    /** The steps written so far: the next ordinal. */
    @Column({ name: "step_seq", type: "integer", default: () => "0" })
    stepSeq!: number

    /** When the run started. */
    @Column({ name: "started_at", type: "timestamptz", default: () => "now()" })
    startedAt!: Date

    /** When it ended or parked, or null. */
    @Column({ name: "ended_at", type: "timestamptz", nullable: true })
    endedAt!: Date | null

    /** When an owner or manager cancelled it, or null. */
    @Column({ name: "cancelled_at", type: "timestamptz", nullable: true })
    cancelledAt!: Date | null

    /** Who cancelled it, or null. */
    @Column({ name: "cancelled_by", type: "text", nullable: true })
    cancelledBy!: string | null

    /**
     * The SUBJECT of the run (`SubjectRef` kind and id: the scope path of its correlation key and its value), or null for a run about no
     * subject. One run in flight per (workspace, workflow, subject) is enforced by the partial unique index
     * `agent_runs_one_in_flight_per_subject` (migration 20261114000300_run-subject.sql), and found exactly through it.
     */
    @Column({ name: "subject_kind", type: "text", nullable: true })
    subjectKind!: string | null

    /** The subject's id (see `subjectKind`), or null. */
    @Column({ name: "subject_id", type: "text", nullable: true })
    subjectId!: string | null

    /**
     * The lookup keys of the `wait` the run is parked on (written when it parks, null once it resumes): how an event finds the run that
     * waits for it by value, exactly, through the GIN index `agent_runs_wait_match` (migration 20261114000600_run-wait-match.sql). The keys'
     * shape is the waits' own (agent-threads/wait-match.policy.ts).
     */
    @Column({ name: "wait_match", type: "text", array: true, nullable: true })
    waitMatch!: Array<string> | null

    /** When the run parked on that wait, or null: among the runs that take one event, the one that started waiting last goes first. */
    @Column({ name: "wait_since", type: "timestamptz", nullable: true })
    waitSince!: Date | null

    /** The workflow it executes, or null for the agent's own graph. */
    @Column({ name: "workflow_id", type: "uuid", nullable: true })
    workflowId!: string | null

    /** The workflow version it executes, or null. */
    @Column({ name: "workflow_version_id", type: "uuid", nullable: true })
    workflowVersionId!: string | null

    /** The number of that workflow version, or null. */
    @Column({ name: "workflow_version", type: "integer", nullable: true })
    workflowVersion!: number | null

    /** The fence of every write. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
