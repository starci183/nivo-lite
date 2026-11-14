import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

/** What the AI judged a truth to be: a rule of how the shop operates, or not (identity or catalogue data). */
export type BrainPolicyKind = "policy" | "not_policy"

/** Whether a judgement still stands: its truth is in force or scheduled (`open`), or nothing holds it any more (`retired`). */
export type BrainPolicyStatus = "open" | "retired"

@Entity({ schema: "public", name: "brain_policies" })
/** The AI's judgement of one truth of the truth graph (public.brain_policies): it holds no value, only the binding to its fact. */
export class BrainPolicyEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The subject key of the truth. */
    @Column({ name: "subject_key", type: "text" })
    subjectKey!: string

    /** The attribute key of the truth. */
    @Column({ name: "attribute", type: "text" })
    attribute!: string

    /** The one agent instance the truth is kept for, or null (the whole shop). */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null

    /** The fact it is bound to: the one it was derived from, then each later value of the same truth. */
    @Column({ name: "fact_id", type: "uuid" })
    factId!: string

    /** The version of that fact; null for a value not in force yet. */
    @Column({ name: "fact_version", type: "integer", nullable: true })
    factVersion!: number | null

    /** The hash of what the judgement read (subject type, labels, value type): unchanged, a new value re-binds with no model call. */
    @Column({ name: "basis", type: "text" })
    basis!: string

    /** `policy` or `not_policy`. */
    @Column({ name: "kind", type: "text" })
    kind!: BrainPolicyKind

    /** The human title of the rule; empty for `not_policy`. */
    @Column({ name: "title", type: "text", default: () => "''::text" })
    title!: string

    /** The slug of the group. */
    @Column({ name: "group_key", type: "text", default: () => "''::text" })
    groupKey!: string

    /** The group as people read it (Delivery). */
    @Column({ name: "group_label", type: "text", default: () => "''::text" })
    groupLabel!: string

    /** The value type read from the fact when it was derived or last bound. */
    @Column({ name: "value_type", type: "text" })
    valueType!: string

    /** The AI's short reason. */
    @Column({ name: "reason", type: "text", default: () => "''::text" })
    reason!: string

    /** `open` or `retired`. */
    @Column({ name: "status", type: "text", default: () => "'open'::text" })
    status!: BrainPolicyStatus

    /** The model that judged it. */
    @Column({ name: "model", type: "text", nullable: true })
    model!: string | null

    /** When it was judged. */
    @Column({ name: "derived_at", type: "timestamptz", default: () => "now()" })
    derivedAt!: Date

    /** When it was retired, or null. */
    @Column({ name: "retired_at", type: "timestamptz", nullable: true })
    retiredAt!: Date | null
}
