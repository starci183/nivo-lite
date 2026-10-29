import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "ai_usage_events" })
/** One model call a workspace paid for, booked when the call finished. */
export class AiUsageEventEntity {
    /** The event id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

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

    /** The cost of the call in USD. */
    @Column({ name: "cost_usd", type: "numeric", precision: 14, scale: 8, default: () => "0" })
    costUsd!: string

    /** True when the figures were estimated from the text length. */
    @Column({ name: "estimated", type: "boolean", default: () => "false" })
    estimated!: boolean

    /** When the call was booked. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
