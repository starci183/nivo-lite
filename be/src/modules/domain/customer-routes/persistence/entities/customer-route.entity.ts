import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "customer_routes" })
/**
 * One route: the way the engine reaches one person on one entrance. ONE row per (workspace, contact, channel, account), written by an
 * insert-or-nothing; its `id` is the opaque route id that every engine column called `conversation_id` (holds, stops, freezes, the
 * speaker queue, burst scopes) keeps holding. The account is the connection, the website site or the API key the entrance goes through,
 * null when the entrance has none.
 */
export class CustomerRouteEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The person the route reaches (the survivor's id at the time the route was born; a merge is followed at read time). */
    @Column({ name: "contact_id", type: "uuid" })
    contactId!: string

    /** The channel: `zalo`, `telegram`, `website`, ... */
    @Column({ name: "channel", type: "text" })
    channel!: string

    /** The connection, site or API key the entrance goes through, or null. */
    @Column({ name: "account_id", type: "uuid", nullable: true })
    accountId!: string | null

    /** The member of the shop who holds the thread (took it over), or null when the agents speak on the route (ruling R43). */
    @Column({ name: "held_by_member_id", type: "uuid", nullable: true })
    heldByMemberId!: string | null

    /** When that member took it, or null when nobody holds it (both null or both set). */
    @Column({ name: "held_at", type: "timestamptz", nullable: true })
    heldAt!: Date | null
}
