import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "provider_sandbox_entries" })
/**
 * One row of public.provider_sandbox_entries: a fixture, a script or a logged call of ONE sandbox account (lane concept
 * provider-sandbox). Read only through a join on a live sandbox connection, so a removed account's entries are hidden with it (R36).
 */
export class ProviderSandboxEntryEntity extends UuidAbstractEntity {
    /** The workspace of the account. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The sandbox account (connection). */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** `fixture`, `script` or `call`. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The provider's word for the operation (`renew`, `issue`). */
    @Column({ name: "operation", type: "text" })
    operation!: string

    /** The provider's key of the request; empty = any key of the operation. */
    @Column({ name: "key", type: "text", default: () => "''::text" })
    key!: string

    /** The fixture value, the script or the call (request + outcome). */
    @Column({ name: "body", type: "jsonb" })
    body!: unknown

    /** A script's calls left; null = every call (and for every other kind). */
    @Column({ name: "remaining", type: "integer", nullable: true })
    remaining!: number | null
}
