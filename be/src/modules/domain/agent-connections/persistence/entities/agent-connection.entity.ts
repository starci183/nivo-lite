import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "agent_connections" })
/** A connection granted to an agent: what the agent uses it for and what it may do through it. */
export class AgentConnectionEntity {
    /** The agent. */
    @PrimaryColumn({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The connection. */
    @PrimaryColumn({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The workspace of both. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** What the agent uses the connection for. */
    @Column({ name: "purpose", type: "text", default: () => "'inbound_chat'::text" })
    purpose!: string

    /** When the grant was made. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** What the agent may do through the connection: read, ask or auto. */
    @Column({ name: "access", type: "text", default: () => "'ask'::text" })
    access!: string
}
