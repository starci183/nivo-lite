import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "account_data" })
/**
 * One row of public.account_data: one thing a provider account (connection) knows, RAW, under the provider's own id. The table is
 * partitioned by `type` (one partition per declared type), so the key is `(type, id)`; `(type, connection_id, key)` is unique, which is
 * the dedupe of every write.
 */
export class AccountDataEntity extends AbstractEntity {
    /** The declared type: the partition the row lives in. */
    @PrimaryColumn({ name: "type", type: "text" })
    type!: string

    /** The row id; the database generates it. */
    @PrimaryColumn({ name: "id", type: "uuid", default: () => "gen_random_uuid()" })
    id!: string

    /** The version of the type's fields the value was written with. */
    @Column({ name: "type_version", type: "integer" })
    typeVersion!: number

    /** The provider of the connection, as `connections.provider` names it. */
    @Column({ name: "provider", type: "text" })
    provider!: string

    /** The provider account the row belongs to. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The workspace of the account. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The provider's own id of the thing: the declared key members joined by ":", hashed when longer than 400 characters. */
    @Column({ name: "key", type: "text" })
    key!: string

    /** The value, members exactly as the type declares them. */
    @Column({ name: "value", type: "jsonb" })
    value!: object

    /** When it happened (the declared member, or when it was written; an overwrite moves it). */
    @Column({ name: "occurred_at", type: "timestamptz", default: () => "now()" })
    occurredAt!: Date

    /** A `wakes` type: when its consumer completed it (null while pending). Null for the other types. */
    @Column({ name: "processed_at", type: "timestamptz", nullable: true })
    processedAt!: Date | null
}
