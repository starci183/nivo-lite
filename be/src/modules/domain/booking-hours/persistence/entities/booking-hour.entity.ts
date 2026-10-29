import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "booking_hours" })
/** One weekly opening window of a resource. */
export class BookingHourEntity {
    /** The window id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The resource. */
    @Column({ name: "resource_id", type: "uuid" })
    resourceId!: string

    /** The ISO weekday, Monday 1 to Sunday 7. */
    @Column({ name: "weekday", type: "smallint" })
    weekday!: number

    /** The opening time. */
    @Column({ name: "start_time", type: "time" })
    startTime!: string

    /** The closing time. */
    @Column({ name: "end_time", type: "time" })
    endTime!: string
}
