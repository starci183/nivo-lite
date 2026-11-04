import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_speaker_queue" })
/** A hand-off that waits for the agent that holds its conversation to hand it on: written as the target's wake once it holds. */
export class AgentSpeakerQueueEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The conversation whose right to speak the hand-off waits for. */
    @Column({ name: "conversation_id", type: "uuid" })
    conversationId!: string

    /** The agent the hand-off is for. */
    @Column({ name: "to_agent_id", type: "uuid" })
    toAgentId!: string

    /** The tag's event key: the same hand-off waits once. */
    @Column({ name: "event_key", type: "text" })
    eventKey!: string

    /** The tag request as the tag door received it, rights already checked. */
    @Column({ name: "request", type: "jsonb" })
    request!: unknown
}
