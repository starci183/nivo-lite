import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "data_records" })
/** One row of public.data_records. */
export class DataRecordEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connection id. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The entity. */
    @Column({ name: "entity", type: "text" })
    entity!: "customer" | "order" | "product" | "transaction" | "message" | "document" | "other"

    /** The external id. */
    @Column({ name: "external_id", type: "text" })
    externalId!: string

    /** The title. */
    @Column({ name: "title", type: "text", default: () => "''::text" })
    title!: string

    /** The occurred at. */
    @Column({ name: "occurred_at", type: "timestamptz", nullable: true })
    occurredAt!: Date | null

    /** The data. */
    @Column({ name: "data", type: "jsonb", default: () => "'{}'::jsonb" })
    data!: object

    /** The synced at. */
    @Column({ name: "synced_at", type: "timestamptz", default: () => "now()" })
    syncedAt!: Date
}
