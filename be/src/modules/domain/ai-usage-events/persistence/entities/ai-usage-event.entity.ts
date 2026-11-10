import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "ai_usage_events" })
/** One model call a workspace paid for, booked when the call finished. */
export class AiUsageEventEntity extends UuidAbstractEntity {
    /** The workspace that paid. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** What the call was for. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The module the call served. */
    @Column({ name: "module", type: "text", default: () => "'other'::text" })
    module!: string

    /** The model that answered. */
    @Column({ name: "model", type: "text", default: () => "''::text" })
    model!: string

    /** The tokens sent to the model. */
    @Column({ name: "prompt_tokens", type: "integer", default: () => "0" })
    promptTokens!: number

    /** The tokens the model wrote. */
    @Column({ name: "completion_tokens", type: "integer", default: () => "0" })
    completionTokens!: number

    /** The tokens of the prompt the provider served from its prompt cache: a part of `promptTokens`, zero when it did not say. */
    @Column({ name: "cached_tokens", type: "integer", default: () => "0" })
    cachedTokens!: number

    /** The cost of the call in USD. */
    @Column({ name: "cost_usd", type: "numeric", precision: 14, scale: 8, default: () => "0" })
    costUsd!: string

    /** True when the figures were estimated from the text length. */
    @Column({ name: "estimated", type: "boolean", default: () => "false" })
    estimated!: boolean

    /** The agent run the call was made for, or null when it belongs to none. */
    @Column({ name: "run_id", type: "uuid", nullable: true })
    runId!: string | null

    /** The call kind: `<node id>:<tag>` of a graph node's call; null for a fixed task of the app. */
    @Column({ name: "purpose", type: "text", nullable: true })
    purpose!: string | null

    /** The part of `completionTokens` the model spent on hidden reasoning (billed, never read); zero when it did not say. */
    @Column({ name: "reasoning_tokens", type: "integer", default: () => "0" })
    reasoningTokens!: number

    /** The wall time of the try that answered, milliseconds; null when not measured. */
    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null

    /** Which try of the call answered, from one (failed tries are never booked); null when not told. */
    @Column({ name: "try_number", type: "smallint", nullable: true })
    tryNumber!: number | null

    /** The upstream of the endpoint that served the call (OpenRouter's `provider`); null when it did not say. */
    @Column({ name: "upstream", type: "text", nullable: true })
    upstream!: string | null

    /** Why the model stopped (`stop`, `tool_calls`); null when it did not say. */
    @Column({ name: "finish_reason", type: "text", nullable: true })
    finishReason!: string | null

    /** What a graph node's call declared: `auto` or a model id; null for a fixed task of the app. */
    @Column({ name: "declared_model", type: "text", nullable: true })
    declaredModel!: string | null

    /** The provider of the model that served the call (`anthropic`, `openrouter`); null when not known. */
    @Column({ name: "model_provider", type: "text", nullable: true })
    modelProvider!: string | null

    /** Why the call went to the model it went to (`auto-heavy`, `default-no-key`, ...); null for a fixed task. */
    @Column({ name: "model_reason", type: "text", nullable: true })
    modelReason!: string | null
}
