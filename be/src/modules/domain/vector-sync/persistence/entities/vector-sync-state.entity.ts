import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "vector_sync_state" })
/** Where the reconcile of one kind of point stands: one row per kind, for the whole deployment. */
export class VectorSyncStateEntity extends AbstractEntity {
    /** The kind of point: passage, truth or base (the table checks it). */
    @PrimaryColumn({ name: "kind", type: "text" })
    kind!: "passage" | "truth" | "base"

    /** The last Postgres row id the walk over the rows compared; null = the next run starts from the first row. */
    @Column({ name: "rows_after", type: "uuid", nullable: true })
    rowsAfter!: string | null

    /** Where the walk over the index's points goes on (the index's own page cursor); null = from the first point. */
    @Column({ name: "points_after", type: "text", nullable: true })
    pointsAfter!: string | null

    /** How many whole passes over the rows have ended. */
    @Column({ name: "passes", type: "integer", default: () => "0" })
    passes!: number

    /** How many consecutive runs ended with drift they could not repair; 0 after a run that repaired everything it met. */
    @Column({ name: "drift_runs", type: "integer", default: () => "0" })
    driftRuns!: number

    /** When the current episode of unrepaired drift began; null while there is none. It keys the one report of the episode. */
    @Column({ name: "drift_since", type: "timestamptz", nullable: true })
    driftSince!: Date | null

    /** When the last run ended. */
    @Column({ name: "last_run_at", type: "timestamptz", nullable: true })
    lastRunAt!: Date | null
}
