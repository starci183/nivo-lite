import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "agent_conversations" })
/** One conversation of an agent: a customer's on a channel, or an owner's test chat. */
export class AgentConversationEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent that speaks in it. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** A customer's conversation or an owner's test chat. */
    @Column({ name: "kind", type: "text" })
    kind!: "customer" | "test"

    /** The name of the customer, when known. */
    @Column({ name: "visitor_name", type: "text", nullable: true })
    visitorName!: string | null

    /** The lead the customer became. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The person who holds the conversation, or null while the agent answers. */
    @Column({ name: "handled_by", type: "text", nullable: true })
    handledBy!: string | null

    /** When the person took it over. */
    @Column({ name: "handled_at", type: "timestamptz", nullable: true })
    handledAt!: Date | null

    /** The channel the customer writes on. */
    @Column({ name: "channel", type: "text", default: () => "'website'::text" })
    channel!: string

    /** The id of the customer on the channel. */
    @Column({ name: "external_id", type: "text", nullable: true })
    externalId!: string | null

    /** The connection the conversation runs on. */
    @Column({ name: "connection_id", type: "uuid", nullable: true })
    connectionId!: string | null

    /** The installation of the agent that speaks in it. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null

    /** The party a connector answered for the customer. */
    @Column({ name: "connector_party_id", type: "text", nullable: true })
    connectorPartyId!: string | null

    /** The name of that party. */
    @Column({ name: "connector_party_name", type: "text", nullable: true })
    connectorPartyName!: string | null

    /** When the connector answered. */
    @Column({ name: "connector_party_at", type: "timestamptz", nullable: true })
    connectorPartyAt!: Date | null
}
