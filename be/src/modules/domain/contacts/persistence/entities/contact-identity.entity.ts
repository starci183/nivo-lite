import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "contact_identities" })
/** One way to reach or recognise a person, in its one normalised form, with its proof (verified) or none (a claim). */
export class ContactIdentityEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The contact. */
    @Column({ name: "contact_id", type: "uuid" })
    contactId!: string

    /** `phone`, `email`, `channel` or `external`. */
    @Column({ name: "kind", type: "text" })
    kind!: string

    /** The channel of a channel id; empty otherwise. */
    @Column({ name: "provider", type: "text", default: "" })
    provider!: string

    /** The account of a channel id or an outside customer; empty otherwise. */
    @Column({ name: "account", type: "text", default: "" })
    account!: string

    /** The normalised value. */
    @Column({ name: "value", type: "text" })
    value!: string

    /** Whether it is proven. */
    @Column({ name: "verified", type: "boolean" })
    verified!: boolean

    /** `channel`, `token` or `member`; null for a claim. */
    @Column({ name: "verified_by", type: "text", nullable: true })
    verifiedBy!: string | null

    /** Where it was learned: `channel`, `step`, `member` or `form`. */
    @Column({ name: "source", type: "text" })
    source!: string

    /** The merge reason that brought it to this contact, or null. */
    @Column({ name: "joined_by", type: "text", nullable: true })
    joinedBy!: string | null

    /**
     * When the contact it belongs to was deleted (a copy of the contact's own mark, set by the same write), or null while it is live. A
     * deleted contact's identities STAY (nothing is removed) and are left out of every read; the verified-unique index is partial on
     * this column being null, so the same person writing again is met as a new contact holding the identity.
     */
    @Column({ name: "erased_at", type: "timestamptz", nullable: true })
    erasedAt!: Date | null
}
