import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import { bigintNumberTransformer } from "@modules/platform/primitives"
import type { AgentTurnStatus } from "../../agent-work.contracts"

@Entity({ schema: "public", name: "agent_turns" })
/** One run of a wake. The proposal is stored in full before any effect, so a crash resumes from it. */
export class AgentTurnEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The wake it answers. */
    @Column({ name: "wake_id", type: "uuid" })
    wakeId!: string

    /** The fence of the attempt. */
    @Column({ name: "fence", type: "bigint", transformer: bigintNumberTransformer })
    fence!: number

    /** What ran the turn. */
    @Column({ name: "runner", type: "text", default: () => "'openclaw'" })
    runner!: string

    /** The runtime's id of the agent, set before the model runs so tool calls find the turn. */
    @Column({ name: "runtime_agent_id", type: "text", nullable: true })
    runtimeAgentId!: string | null

    /** The runtime's session key, set before the model runs. */
    @Column({ name: "thread_key", type: "text", nullable: true })
    threadKey!: string | null

    /** Where the turn stands; constrained by a CHECK. */
    @Column({ name: "status", type: "text", default: () => "'running'" })
    status!: AgentTurnStatus

    /** What the model proposed, or null. */
    @Column({ name: "proposal", type: "jsonb", nullable: true })
    proposal!: unknown

    /** What was done with it, or null. */
    @Column({ name: "outcome", type: "jsonb", nullable: true })
    outcome!: unknown

    /** `provider/model`, or null. */
    @Column({ name: "model", type: "text", nullable: true })
    model!: string | null

    /** Prompt tokens, or null. */
    @Column({ name: "prompt_tokens", type: "integer", nullable: true })
    promptTokens!: number | null

    /** Completion tokens, or null. */
    @Column({ name: "completion_tokens", type: "integer", nullable: true })
    completionTokens!: number | null

    /** The provider cost as the driver returns a numeric: text. */
    @Column({ name: "cost", type: "numeric", precision: 14, scale: 6, nullable: true })
    cost!: string | null

    /** Wall time of the model call, or null. */
    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null

    /** The error code of a failed turn, or null. */
    @Column({ name: "error_code", type: "text", nullable: true })
    errorCode!: string | null
}
