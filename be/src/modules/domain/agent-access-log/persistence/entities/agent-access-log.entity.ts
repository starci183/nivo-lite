import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "agent_access_log" })
/** One recorded change of the access an agent holds on a connection. */
export class AgentAccessLogEntity {
    /** The log row id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace of the change. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connection whose access changed. */
    @Column({ name: "connection_id", type: "uuid", nullable: true })
    connectionId!: string | null

    /** The agent whose access changed. */
    @Column({ name: "agent_id", type: "uuid", nullable: true })
    agentId!: string | null

    /** The connection name when it changed. */
    @Column({ name: "connection_name", type: "text", default: () => "''::text" })
    connectionName!: string

    /** The agent name when it changed. */
    @Column({ name: "agent_name", type: "text", default: () => "''::text" })
    agentName!: string

    /** The access before the change. */
    @Column({ name: "before_access", type: "text", nullable: true })
    beforeAccess!: string | null

    /** The access after the change. */
    @Column({ name: "after_access", type: "text", nullable: true })
    afterAccess!: string | null

    /** The member that changed it. */
    @Column({ name: "changed_by", type: "uuid", nullable: true })
    changedBy!: string | null

    /** The member name when it changed. */
    @Column({ name: "changed_by_name", type: "text", default: () => "''::text" })
    changedByName!: string

    /** The time of the change. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
