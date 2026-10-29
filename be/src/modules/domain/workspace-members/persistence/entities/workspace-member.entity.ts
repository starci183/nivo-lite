import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { WorkspaceRole } from "../../workspace-members.contracts"

@Entity({ schema: "public", name: "workspace_members" })
/** One seat of a person in a workspace. */
export class WorkspaceMemberEntity {
    /** The seat id: what steps, grants and decisions name, not the Auth account. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

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

    /** When the seat was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
