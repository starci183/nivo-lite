import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "conversation_ownership_events" })
/** One row of public.conversation_ownership_events. */
export class ConversationOwnershipEventEntity extends UuidAbstractEntity {
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
}
