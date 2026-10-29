import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "connector_interest" })
/** One row of public.connector_interest. */
export class ConnectorInterestEntity {
    /** The workspace id. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connector id. */
    @PrimaryColumn({ name: "connector_id", type: "text" })
    connectorId!: string

    /** The user id. */
    @Column({ name: "user_id", type: "uuid", nullable: true })
    userId!: string | null

    /** The created at. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
