import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "contacts" })
/**
 * One person the agents work with (the engine's subject of a thread), whatever the source, stage or role. A `merged` or `erased` row is
 * a tombstone: the id stays so the history that names it does not dangle. `erased` (with `erased_at`) is the SOFT DELETE mark (owner
 * ruling R31): a deleted contact keeps its identities, memory, routes and customer lines, and every read leaves them out; the row is
 * never hard-deleted.
 */
export class ContactEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The name the person is shown by; null when nobody knows it. */
    @Column({ name: "display_name", type: "text", nullable: true })
    displayName!: string | null

    /** Generic labels. */
    @Column({ name: "tags", type: "text", array: true, default: () => "'{}'::text[]" })
    tags!: Array<string>

    /** `active`, `merged` or `erased`. */
    @Column({ name: "state", type: "text", default: "active" })
    state!: string

    /** When it was deleted (the soft-delete mark; always set with state `erased`), or null. */
    @Column({ name: "erased_at", type: "timestamptz", nullable: true })
    erasedAt!: Date | null
}
