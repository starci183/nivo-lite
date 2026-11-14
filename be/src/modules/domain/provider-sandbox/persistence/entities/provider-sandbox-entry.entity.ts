import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "provider_sandbox_entries" })
/**
 * One row of public.provider_sandbox_entries: the STATE a call changed or a logged call of ONE sandbox account (lane concept
 * provider-sandbox). Read only through a join on a live sandbox connection, so a removed account's entries are hidden with it (R36).
 */
export class ProviderSandboxEntryEntity extends UuidAbstractEntity {
    /** The workspace of the account. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The sandbox account (connection). */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** `state` or `call`. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The state's name, or the call's operation (`renew`, `issue`). */
    @Column({ name: "operation", type: "text" })
    operation!: string

    /** The key of the state or of the call's request. */
    @Column({ name: "key", type: "text", default: () => "''::text" })
    key!: string

    /** The state's value, or the call (request + outcome). */
    @Column({ name: "body", type: "jsonb" })
    body!: unknown
}
