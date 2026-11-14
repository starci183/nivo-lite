import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** Where a lesson candidate stands. */
export type LessonCandidateStatus = "candidate" | "proposing" | "proposed" | "learned" | "declined"

/** What the stopped step did after the person's words. */
export type LessonCandidateThen = "completed" | "stopped_again" | "skipped" | "open"

@Entity({ schema: "public", name: "brain_lesson_candidates" })
/** One answered stop kept as a lesson candidate (public.brain_lesson_candidates). */
export class BrainLessonCandidateEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The stop that was answered. */
    @Column({ name: "stop_id", type: "uuid" })
    stopId!: string

    /** The run of the stop. */
    @Column({ name: "run_id", type: "uuid" })
    runId!: string

    /** The step that stopped. */
    @Column({ name: "step_key", type: "text" })
    stepKey!: string

    /** The agent that asked. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The workflow, or null for an agent's own graph. */
    @Column({ name: "workflow_id", type: "uuid", nullable: true })
    workflowId!: string | null

    /** The question the agent could not handle, masked. */
    @Column({ name: "question", type: "text" })
    question!: string

    /** No longer written (stays empty): no code reads the words of a question; the draft call's model groups the answers. */
    @Column({ name: "keywords", type: "text", array: true, default: () => "'{}'::text[]" })
    keywords!: Array<string>

    /** The person's words, masked. */
    @Column({ name: "answer", type: "text" })
    answer!: string

    /** The member who answered. */
    @Column({ name: "answered_by", type: "text" })
    answeredBy!: string

    /** When they answered. */
    @Column({ name: "answered_at", type: "timestamptz" })
    answeredAt!: Date

    /** What the step then did. */
    @Column({ name: "then_did", type: "text" })
    thenDid!: LessonCandidateThen

    /** Whether the words state a general rule (null = not judged). */
    @Column({ name: "general", type: "boolean", nullable: true })
    general!: boolean | null

    /** The candidate's own group id, given when kept; a card gathers its answers by `change_id`. */
    @Column({ name: "group_id", type: "uuid" })
    groupId!: string

    /** Where it stands. */
    @Column({ name: "status", type: "text", default: () => "'candidate'::text" })
    status!: LessonCandidateStatus

    /** The brain.change card that proposes its truth. */
    @Column({ name: "change_id", type: "text", nullable: true })
    changeId!: string | null

    /** The slug of the proposed truth's key. */
    @Column({ name: "fact_slug", type: "text", nullable: true })
    factSlug!: string | null

    /** The proposed truth's key. */
    @Column({ name: "fact_key", type: "jsonb", nullable: true })
    factKey!: { subjectLabel: string; attributeLabel: string } | null

    /** The truth in force once learned. */
    @Column({ name: "fact_id", type: "uuid", nullable: true })
    factId!: string | null
}
