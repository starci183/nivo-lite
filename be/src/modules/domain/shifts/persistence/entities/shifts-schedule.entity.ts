import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "shifts_schedules" })
/** One version of the schedule of a week. */
export class ShiftsScheduleEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The Monday of the week. */
    @Column({ name: "week_start", type: "date" })
    weekStart!: string

    /** The version of that week. */
    @Column({ name: "version", type: "int", default: () => "1" })
    version!: number

    /** draft, pending, published or superseded. */
    @Column({ name: "status", type: "text", default: () => "'draft'::text" })
    status!: string

    /** Where it came from. */
    @Column({ name: "source", type: "text", default: () => "'solver'::text" })
    source!: string

    /** The labour cost in VND (a bigint, so text). */
    @Column({ name: "cost_vnd", type: "bigint", default: () => "0" })
    costVnd!: string

    /** The summary of the plan. */
    @Column({ name: "summary", type: "jsonb", default: () => "'{}'::jsonb" })
    summary!: unknown

    /** The evidence of the plan. */
    @Column({ name: "evidence", type: "jsonb", default: () => "'{}'::jsonb" })
    evidence!: unknown

    /** The explanation written for the manager. */
    @Column({ name: "explanation", type: "text", default: () => "''::text" })
    explanation!: string

    /** How long the solver ran, or null. */
    @Column({ name: "solver_ms", type: "int", nullable: true })
    solverMs!: number | null

    /** The decision about publishing it, or null. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** Who made it, or null. */
    @Column({ name: "created_by", type: "text", nullable: true })
    createdBy!: string | null

    /** When it was published, or null. */
    @Column({ name: "published_at", type: "timestamptz", nullable: true })
    publishedAt!: Date | null
}
