import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_run_steps" })
/**
 * One step of a run as the thread projection writes it: its place, its effect, its try and the result it stored, unique per run and step
 * key; deleted with its run. `version` fences every write, so a writer that lost its race reads again.
 */
export class AgentRunStepEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The run. */
    @Column({ name: "run_id", type: "uuid" })
    runId!: string

    /** The place in the run. */
    @Column({ name: "ordinal", type: "integer" })
    ordinal!: number

    /** Unique within the run. */
    @Column({ name: "step_key", type: "text" })
    stepKey!: string

    /** The node of the published graph. */
    @Column({ name: "node_key", type: "text" })
    nodeKey!: string

    /** The handler kind. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** What it does to the world. */
    @Column({ name: "effect", type: "jsonb" })
    effect!: object

    /** All the step needs to run. */
    @Column({ name: "input", type: "jsonb" })
    input!: object

    /** The stored result, or null. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: object | null

    /** Where it stands. */
    @Column({ name: "status", type: "text", default: () => "'pending'" })
    status!: string

    /** The tries made. */
    @Column({ name: "attempt", type: "integer", default: () => "0" })
    attempt!: number

    /** The tries it gets. */
    @Column({ name: "max_attempts", type: "integer", default: () => "3" })
    maxAttempts!: number

    /** How long one try may run, milliseconds, or null. */
    @Column({ name: "deadline_ms", type: "integer", nullable: true })
    deadlineMs!: number | null

    /** The earliest the next try may start, or null. */
    @Column({ name: "not_before", type: "timestamptz", nullable: true })
    notBefore!: Date | null

    /** The work item it waits on, or null. */
    @Column({ name: "wait_item_id", type: "uuid", nullable: true })
    waitItemId!: string | null

    /** The work item it is about, kept after the wait, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The compensation tries made. */
    @Column({ name: "comp_attempts", type: "integer", default: () => "0" })
    compAttempts!: number

    /** Why it last failed, or null. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null

    /** When the claim runs out, or null. */
    @Column({ name: "claimed_until", type: "timestamptz", nullable: true })
    claimedUntil!: Date | null

    /** When this try began, or null. */
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null

    /** When this try ended, or null. */
    @Column({ name: "ended_at", type: "timestamptz", nullable: true })
    endedAt!: Date | null

    /** How long it took, milliseconds, or null. */
    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null

    /** The door calls it made, `{ calls: [...] }`. */
    @Column({ name: "door_calls", type: "jsonb" })
    doorCalls!: object

    /** The effect key it was sent under, or null. */
    @Column({ name: "effect_key", type: "text", nullable: true })
    effectKey!: string | null

    /** The error it stopped with, or null. */
    @Column({ name: "error", type: "jsonb", nullable: true })
    error!: object | null

    /** The fence of every write. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
