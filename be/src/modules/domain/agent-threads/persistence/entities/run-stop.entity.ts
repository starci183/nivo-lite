import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "run_stops" })
/**
 * The stop of one step of one run: the one mechanism for every run that cannot go on by itself. One row per run and step: what the AI
 * core (or the engine) said, the /chat card it posted (rewritten in place), the lines the stopped step sent customers, the founder's
 * answers in order and the decision that resolved it. A step that stops again reopens the same row (`repeats`); `version` fences writes.
 */
export class RunStopEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The run (the thread). */
    @Column({ name: "run_id", type: "uuid" })
    runId!: string

    /** The step that stopped. */
    @Column({ name: "step_key", type: "text" })
    stepKey!: string

    /** The agent of the run. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The workflow the run executes, or null for an agent's own graph. */
    @Column({ name: "workflow_id", type: "uuid", nullable: true })
    workflowId!: string | null

    /** The customer, when the run names one (kept as written: a merge redirects at read time). */
    @Column({ name: "contact_id", type: "uuid", nullable: true })
    contactId!: string | null

    /** The conversation of the run, when it has one. */
    @Column({ name: "route_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** `ai_report`, `ai_error`, `approval` or `engine`. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** `open` or `resolved`. */
    @Column({ name: "state", type: "text", default: "open" })
    state!: string

    /** The reason. */
    @Column({ name: "reason", type: "text" })
    reason!: string

    /** The question for the founder, or null. */
    @Column({ name: "question", type: "text", nullable: true })
    question!: string | null

    /** The suggestions and the engine's facts (`{ suggestions, facts }`). */
    @Column({ name: "detail", type: "jsonb" })
    detail!: object

    /** The team chat message of the stop's card, once posted. */
    @Column({ name: "card_message_id", type: "uuid", nullable: true })
    cardMessageId!: string | null

    /** The lines the stopped step sent customers (`{ lines }`). */
    @Column({ name: "customer_lines", type: "jsonb" })
    customerLines!: object

    /** Every answer the stop received (`{ answers }`). */
    @Column({ name: "answers", type: "jsonb" })
    answers!: object

    /** The decision that resolved it, or null. */
    @Column({ name: "decision", type: "jsonb", nullable: true })
    decision!: object | null

    /** How many times this step of this run stopped. */
    @Column({ name: "repeats", type: "integer", default: () => "1" })
    repeats!: number

    /** When it last stopped. */
    @Column({ name: "stopped_at", type: "timestamptz" })
    stoppedAt!: Date

    /** When it was resolved, or null. */
    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null

    /** The fence of every write. */
    @Column({ name: "version", type: "integer", default: () => "1" })
    version!: number
}
