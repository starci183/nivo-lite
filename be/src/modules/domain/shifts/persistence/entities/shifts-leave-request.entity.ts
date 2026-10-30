import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "shifts_leave_requests" })
/** A request for days off. */
export class ShiftsLeaveRequestEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The shifts profile. */
    @Column({ name: "staff_id", type: "uuid" })
    staffId!: string

    /** The first day. */
    @Column({ name: "from_date", type: "date" })
    fromDate!: string

    /** The last day. */
    @Column({ name: "to_date", type: "date" })
    toDate!: string

    /** The reason. */
    @Column({ name: "reason", type: "text", default: () => "''::text" })
    reason!: string

    /** pending, approved or rejected. */
    @Column({ name: "status", type: "text", default: () => "'pending'::text" })
    status!: string

    /** The decision about it, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** Who decided it, or null. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** When it was decided, or null. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null
}
