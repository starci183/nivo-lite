import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "conversation_ownership_events" })
/** One row of public.conversation_ownership_events. */
export class ConversationOwnershipEventEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The conversation id. */
    @Column({ name: "conversation_id", type: "uuid" })
    conversationId!: string

    /** The from agent id. */
    @Column({ name: "from_agent_id", type: "uuid", nullable: true })
    fromAgentId!: string | null

    /** The to agent id. */
    @Column({ name: "to_agent_id", type: "uuid" })
    toAgentId!: string

    /** The reason. */
    @Column({ name: "reason", type: "text" })
    reason!: string

    /** The created at. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
