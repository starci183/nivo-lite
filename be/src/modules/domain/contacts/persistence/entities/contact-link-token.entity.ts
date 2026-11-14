import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "contact_link_tokens" })
/** A one-time link token issued for a contact: only its hash is kept; presenting it once proves the person is that contact. */
export class ContactLinkTokenEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The contact it was issued for. */
    @Column({ name: "contact_id", type: "uuid" })
    contactId!: string

    /** The SHA-256 of the token, hex. */
    @Column({ name: "token_hash", type: "text" })
    tokenHash!: string

    /** When it stops being valid. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date

    /** When it was used, or null. */
    @Column({ name: "used_at", type: "timestamptz", nullable: true })
    usedAt!: Date | null

    /** The contact that presented it, or null. */
    @Column({ name: "used_by_contact_id", type: "uuid", nullable: true })
    usedByContactId!: string | null
}
