import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "connector_interest" })
/** One row of public.connector_interest. */
export class ConnectorInterestEntity extends AbstractEntity {
    /** The workspace id. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connector id. */
    @PrimaryColumn({ name: "connector_id", type: "text" })
    connectorId!: string

    /** The user id. */
    @Column({ name: "user_id", type: "uuid", nullable: true })
    userId!: string | null
}
