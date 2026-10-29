import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "staff" })
/** A staff record of one workspace, used by the accounting assignment picker and the shifts workbench. */
export class StaffEntity {
    /** The staff id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace the person works for. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The display name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The staff role label. */
    @Column({ name: "role", type: "text", default: "" })
    role!: string

    /** The optional contact email. */
    @Column({ name: "email", type: "text", nullable: true })
    email!: string | null

    /** Whether the person is active. */
    @Column({ name: "active", type: "boolean", default: true })
    active!: boolean

    /** When the record was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
