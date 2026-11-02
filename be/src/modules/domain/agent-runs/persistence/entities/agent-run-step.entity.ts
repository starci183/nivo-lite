import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import { bigintNumberTransformer } from "@modules/platform/primitives"
import type { AgentStepStatus, StepEffect } from "../../agent-runs.contracts"

@Entity({ schema: "public", name: "agent_run_steps" })
/** One step of a run: its place, its effect, its claim and the result it stored. Written by the database functions only. */
export class AgentRunStepEntity extends UuidAbstractEntity {
    /** The run. */
    @Column({ name: "run_id", type: "uuid" })
    runId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The place in the run: steps run in this order. */
    @Column({ name: "seq", type: "integer" })
    seq!: number

    /** Unique within the run. */
    @Column({ name: "step_key", type: "text" })
    stepKey!: string

    /** The node of the published graph this step is. */
    @Column({ name: "node_key", type: "text" })
    nodeKey!: string

    /** The handler kind that runs it. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** What it does to the world. */
    @Column({ name: "effect", type: "jsonb" })
    effect!: StepEffect

    /** All the step needs to run from the row alone. */
    @Column({ name: "input", type: "jsonb", default: () => "'{}'" })
    input!: Record<string, unknown>

    /** Where the step stands; constrained by a CHECK. */
    @Column({ name: "status", type: "text", default: () => "'pending'" })
    status!: AgentStepStatus

    /** The tries made. */
    @Column({ name: "attempt", type: "smallint", default: 0 })
    attempt!: number

    /** The tries it gets. */
    @Column({ name: "max_attempts", type: "smallint", default: 3 })
    maxAttempts!: number

    /** How long one try may run, milliseconds. */
    @Column({ name: "deadline_ms", type: "integer" })
    deadlineMs!: number

    /** The fence of the claim. */
    @Column({ name: "fence", type: "bigint", transformer: bigintNumberTransformer })
    fence!: number

    /** The work item the step waits on, or null. */
    @Column({ name: "wait_item_id", type: "uuid", nullable: true })
    waitItemId!: string | null

    /** The stored result, or null. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: Record<string, unknown> | null

    /** Why the step last failed, or null. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null

    /** The earliest the next try may start: the backoff after a failed try. */
    @Column({ name: "not_before", type: "timestamptz" })
    notBefore!: Date

    /** When the claim runs out, or null. */
    @Column({ name: "claim_until", type: "timestamptz", nullable: true })
    claimUntil!: Date | null
}
