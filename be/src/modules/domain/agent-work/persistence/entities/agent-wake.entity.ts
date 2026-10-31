import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { AgentWakeContext, AgentWakeSource, AgentWakeStatus } from "../../agent-work.contracts"

@Entity({ schema: "public", name: "agent_wakes" })
/** One reason an agent has to act. The unique (agent, source, event key) is the fact: a redelivered webhook or a replayed event writes nothing. */
export class AgentWakeEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** What woke the agent; constrained by a CHECK. */
    @Column({ name: "source", type: "text" })
    source!: AgentWakeSource

    /** Stable for one fact. */
    @Column({ name: "event_key", type: "text" })
    eventKey!: string

    /** The lock scope: `agent`, or `conversation:<id>`. */
    @Column({ name: "scope_key", type: "text", default: () => "'agent'" })
    scopeKey!: string

    /** Lower runs first. */
    @Column({ name: "priority", type: "smallint" })
    priority!: number

    /** The attempts the wake may have. */
    @Column({ name: "max_attempts", type: "smallint", default: 3 })
    maxAttempts!: number

    /** Ids and flags only. */
    @Column({ name: "context", type: "jsonb", default: () => "'{}'::jsonb" })
    context!: AgentWakeContext

    /** The member behind the wake, or null. */
    @Column({ name: "actor_member_id", type: "uuid", nullable: true })
    actorMemberId!: string | null

    /** Where the wake stands; constrained by a CHECK. */
    @Column({ name: "status", type: "text", default: () => "'pending'" })
    status!: AgentWakeStatus

    /** Why it was skipped, held, failed or given up, or null. */
    @Column({ name: "reason", type: "text", nullable: true })
    reason!: string | null

    /** Attempts so far; the database counts them before the model runs. */
    @Column({ name: "attempts", type: "smallint", default: 0 })
    attempts!: number

    /** Not before this moment: a retry waits here. */
    @Column({ name: "not_before", type: "timestamptz", insert: false })
    notBefore!: Date

    /** When the first attempt began, or null. */
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null

    /** When the wake ended, or null. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
