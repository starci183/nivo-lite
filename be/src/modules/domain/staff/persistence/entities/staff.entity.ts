import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "staff" })
/** A staff record of one workspace, used by the accounting assignment picker and the shifts workbench. */
export class StaffEntity extends UuidAbstractEntity {
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
}
