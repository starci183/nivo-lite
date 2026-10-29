import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "data_sync_runs" })
/** One row of public.data_sync_runs. */
export class DataSyncRunEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connection id. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The started at. */
    @Column({ name: "started_at", type: "timestamptz", default: () => "now()" })
    startedAt!: Date

    /** The finished at. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null

    /** The status. */
    @Column({ name: "status", type: "text", default: () => "'running'::text" })
    status!: "running" | "ok" | "failed"

    /** The rows upserted. */
    @Column({ name: "rows_upserted", type: "int", default: () => "0" })
    rowsUpserted!: number

    /** The error. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** The trigger. */
    @Column({ name: "trigger", type: "text", default: () => "'schedule'::text" })
    trigger!: "schedule" | "manual" | "upload" | "push"
}
