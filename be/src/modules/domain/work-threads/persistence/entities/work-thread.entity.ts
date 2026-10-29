import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

/** Where a thread stands, as the table checks it. */
export type WorkThreadState = "open" | "waiting" | "done" | "stopped"

@Entity({ schema: "public", name: "work_threads" })
/** One work thread of a workspace: members and agents write in it, optionally about one lead or one order. */
export class WorkThreadEntity {
    /** The thread id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The title. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** The lead the thread is about, or null. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The order the thread is about, or null. */
    @Column({ name: "order_id", type: "uuid", nullable: true })
    orderId!: string | null

    /** Where the thread stands. */
    @Column({ name: "status", type: "text", default: () => "'open'" })
    status!: WorkThreadState

    /** The member id of whoever opened it. */
    @Column({ name: "created_by", type: "uuid" })
    createdBy!: string

    /** When it opened. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date

    /** When it last changed. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date
}
