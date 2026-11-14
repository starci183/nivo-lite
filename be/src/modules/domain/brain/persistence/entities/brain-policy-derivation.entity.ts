import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

/** Where the derive pass of a workspace stands. */
export type BrainPolicyDerivationStatus = "queued" | "running" | "idle" | "failed"

/** Why a pass failed: the model gave no usable answer, the credits ran out, or the queue's retries ran out. */
export type BrainPolicyDerivationError = "model" | "credits" | "gave_up"

@Entity({ schema: "public", name: "brain_policy_derivations" })
/** The state of the derive pass of one workspace (public.brain_policy_derivations). */
export class BrainPolicyDerivationEntity extends AbstractEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** `queued`, `running`, `idle` or `failed`. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: BrainPolicyDerivationStatus

    /** When a fact change last asked for a pass. */
    @Column({ name: "requested_at", type: "timestamptz", default: () => "now()" })
    requestedAt!: Date

    /** When the last pass started. */
    @Column({ name: "started_at", type: "timestamptz", nullable: true })
    startedAt!: Date | null

    /** When a pass last left nothing to judge. */
    @Column({ name: "derived_at", type: "timestamptz", nullable: true })
    derivedAt!: Date | null

    /** Tries that failed in a row. */
    @Column({ name: "attempts", type: "integer", default: () => "0" })
    attempts!: number

    /** Why the last pass failed, or null. */
    @Column({ name: "error", type: "text", nullable: true })
    error!: BrainPolicyDerivationError | null
}
