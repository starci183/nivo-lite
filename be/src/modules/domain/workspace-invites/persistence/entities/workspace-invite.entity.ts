import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

/** The roles an invitation may grant, as the table checks them. */
export type WorkspaceInviteRole = "manager" | "staff"

@Entity({ schema: "public", name: "workspace_invites" })
/** One invitation into a workspace, stored by the SHA-256 hash of its token. */
export class WorkspaceInviteEntity extends UuidAbstractEntity {
    /** The workspace it belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The invited address. */
    @Column({ name: "email", type: "text" })
    email!: string

    /** The role it grants. */
    @Column({ name: "role", type: "text" })
    role!: WorkspaceInviteRole

    /** The staff row it links, when any. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null

    /** The hex SHA-256 of the raw token; the raw token is never stored. */
    @Column({ name: "token_hash", type: "text" })
    tokenHash!: string

    /** The person who issued it. */
    @Column({ name: "invited_by", type: "uuid", nullable: true })
    invitedBy!: string | null

    /** When the link stops working. */
    @Column({ name: "expires_at", type: "timestamptz", default: () => "now() + '7 days'::interval" })
    expiresAt!: Date

    /** Set once accepted. */
    @Column({ name: "accepted_at", type: "timestamptz", nullable: true })
    acceptedAt!: Date | null

    /** The person who accepted it. */
    @Column({ name: "accepted_by", type: "uuid", nullable: true })
    acceptedBy!: string | null

    /** Set once revoked. */
    @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
    revokedAt!: Date | null
}
