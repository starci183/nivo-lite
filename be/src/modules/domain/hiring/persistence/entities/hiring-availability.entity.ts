import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "hiring_availability" })
/** One weekly window in which a member can interview. */
export class HiringAvailabilityEntity extends UuidAbstractEntity {
    /** The workspace the window belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The member who declared it. */
    @Column({ name: "member_user_id", type: "uuid" })
    memberUserId!: string

    /** The weekday, 0 (Sunday) to 6. */
    @Column({ name: "weekday", type: "smallint" })
    weekday!: number

    /** Minutes from midnight, Vietnam time, where the window starts. */
    @Column({ name: "start_min", type: "integer" })
    startMin!: number

    /** Minutes from midnight, Vietnam time, where the window ends. */
    @Column({ name: "end_min", type: "integer" })
    endMin!: number
}
