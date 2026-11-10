import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import type { WorkspaceRole } from "../../workspace-members.contracts"

@Entity({ schema: "public", name: "workspace_members" })
/** One seat of a person in a workspace. */
export class WorkspaceMemberEntity extends UuidAbstractEntity {
    /** The workspace the seat belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The Auth user. */
    @Column({ name: "user_id", type: "uuid" })
    userId!: string

    /** The role: owner, manager or staff. */
    @Column({ name: "role", type: "text" })
    role!: WorkspaceRole

    /** The staff row the account is, or null. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null

    /** The name Office and the decision history show. */
    @Column({ name: "display_name", type: "text" })
    displayName!: string

    /** Whether the seat is active or disabled. */
    @Column({ name: "status", type: "text", default: () => "'active'::text" })
    status!: "active" | "disabled"

    /** When the member last opened the workspace; null until the first open. */
    @Column({ name: "last_opened_at", type: "timestamptz", nullable: true })
    lastOpenedAt!: Date | null

    /** When the seat was switched off; null while it is on. */
    @Column({ name: "disabled_at", type: "timestamptz", nullable: true })
    disabledAt!: Date | null

    /** The Auth user who switched the seat off. */
    @Column({ name: "disabled_by", type: "uuid", nullable: true })
    disabledBy!: string | null

    /** The note left when the seat was switched off. */
    @Column({ name: "disabled_note", type: "text", nullable: true })
    disabledNote!: string | null

    /** Switched off by the deletion of its workspace: restoring the workspace switches it on again. */
    @Column({ name: "disabled_by_deletion", type: "boolean", default: () => "false" })
    disabledByDeletion!: boolean
}
