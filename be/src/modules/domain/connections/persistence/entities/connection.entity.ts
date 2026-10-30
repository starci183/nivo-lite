import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "connections" })
/** One row of public.connections: a workspace's link to one outside provider. */
export class ConnectionEntity extends UuidAbstractEntity {
    /** The workspace that owns the connection. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The provider key that selects the connector behaviour. */
    @Column({ name: "provider", type: "text" })
    provider!: string

    /** The label the workspace gave the connection. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** Provider details safe to show the browser. */
    @Column({ name: "public_meta", type: "jsonb", default: () => "'{}'::jsonb" })
    publicMeta!: Record<string, unknown>

    /** The lifecycle status: pending, connected, error or disconnected. */
    @Column({ name: "status", type: "text", default: () => "'connected'::text" })
    status!: string

    /** The last failure message shown to the user; null when healthy. */
    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null

    /** The member who created the connection; null for system-created ones. */
    @Column({ name: "created_by", type: "uuid", nullable: true })
    createdBy!: string | null

    /** `test` or `live`. */
    @Column({ name: "environment", type: "text", default: () => "'live'::text" })
    environment!: string

    /** When the provider last delivered an event; null when it never has. */
    @Column({ name: "last_event_at", type: "timestamptz", nullable: true })
    lastEventAt!: Date | null

    /** The first delivered event kept as proof the webhook works. */
    @Column({ name: "first_event", type: "jsonb", nullable: true })
    firstEvent!: Record<string, unknown> | null

    /** Whether this is the workspace default of its provider. */
    @Column({ name: "is_default", type: "boolean", default: () => "false" })
    isDefault!: boolean

    /** Minutes between two scheduled syncs; null is manual only. */
    @Column({ name: "sync_every_minutes", type: "integer", nullable: true })
    syncEveryMinutes!: number | null

    /** When the last sync finished. */
    @Column({ name: "last_sync_at", type: "timestamptz", nullable: true })
    lastSyncAt!: Date | null

    /** When the next scheduled sync is due. */
    @Column({ name: "next_sync_at", type: "timestamptz", nullable: true })
    nextSyncAt!: Date | null
}
