import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { RunPayload, RunStatus, RunStep } from "../../automation-runs.contracts"

@Entity({ schema: "public", name: "automation_runs" })
/** One run of a pipeline, unique per pipeline and dedupe key. */
export class AutomationRunEntity extends UuidAbstractEntity {
    /** The pipeline. */
    @Column({ name: "pipeline_id", type: "uuid" })
    pipelineId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** What triggered it. */
    @Column({ name: "trigger_ref", type: "text", default: () => "''::text" })
    triggerRef!: string

    /** The key that keeps one trigger from running twice. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string

    /** What the trigger carried. */
    @Column({ name: "payload", type: "jsonb", default: () => "'{}'::jsonb" })
    payload!: RunPayload

    /** How the run stands. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: RunStatus

    /** The steps recorded so far. */
    @Column({ name: "steps", type: "jsonb", default: () => "'[]'::jsonb" })
    steps!: Array<RunStep>

    /** Why it did this. */
    @Column({ name: "evidence", type: "text", nullable: true })
    evidence!: string | null

    /** The error of the last attempt. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: string | null

    /** How many attempts were started. */
    @Column({ name: "attempts", type: "integer", default: () => "0" })
    attempts!: number

    /** When the run is due. */
    @Column({ name: "run_at", type: "timestamptz", default: () => "now()" })
    runAt!: Date

    /** When the run ended. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
