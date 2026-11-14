import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_node_effects" })
/**
 * The effect ledger: ONE row per call key in the workspace (`effect_key` unique), written once after the act, with the effect that ran,
 * the subject it touched (or `outcome-unknown` and its code), the run and step of the call, its arguments and the facts it answered. A
 * replay reads the row and answers the kept subject; the row is never rewritten.
 */
export class NodeEffectEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The ledger key of the call. */
    @Column({ name: "effect_key", type: "text" })
    effectKey!: string

    /** The effect that ran. */
    @Column({ name: "effect_id", type: "text" })
    effectId!: string

    /** The data kind of the subject it touched (`outcome-unknown` when nobody knows whether it acted). */
    @Column({ name: "subject_entity", type: "text" })
    subjectEntity!: string

    /** The id of the subject (the code of an unknown outcome). */
    @Column({ name: "subject_id", type: "text" })
    subjectId!: string

    /** When the act was taken back, or null. */
    @Column({ name: "undone_at", type: "timestamptz", nullable: true })
    undoneAt!: Date | null

    /** The run of the call, or null for a key of another shape. */
    @Column({ name: "run_id", type: "uuid", nullable: true })
    runId!: string | null

    /** The step of the run, or null. */
    @Column({ name: "step_key", type: "text", nullable: true })
    stepKey!: string | null

    /** The arguments of the call, or null when not kept. */
    @Column({ name: "args", type: "jsonb", nullable: true })
    args!: object | null

    /** The facts the act answered, or null. */
    @Column({ name: "facts", type: "jsonb", nullable: true })
    facts!: object | null
}
