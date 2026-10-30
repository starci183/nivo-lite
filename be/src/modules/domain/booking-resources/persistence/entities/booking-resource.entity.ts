import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "booking_resources" })
/** A bookable person, room or chair of a workspace. */
export class BookingResourceEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The resource name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The resource kind. */
    @Column({ name: "kind", type: "text", default: () => "'staff'::text" })
    kind!: string

    /** How many bookings it holds at once. */
    @Column({ name: "capacity", type: "integer", default: () => "1" })
    capacity!: number

    /** The calendar colour. */
    @Column({ name: "color", type: "text", default: () => "''::text" })
    color!: string

    /** Whether it takes bookings. */
    @Column({ name: "active", type: "boolean", default: () => "true" })
    active!: boolean

    /** The staff member behind it. */
    @Column({ name: "staff_id", type: "uuid", nullable: true })
    staffId!: string | null

    /** The display order. */
    @Column({ name: "sort_order", type: "integer", default: () => "0" })
    sortOrder!: number
}
