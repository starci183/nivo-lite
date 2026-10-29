import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "brain_eval_cases" })
/** One row of public.brain_eval_cases. */
export class BrainEvalCaseEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module. */
    @Column({ name: "module", type: "text", nullable: true })
    module!: string | null

    /** The kind. */
    @Column({ name: "kind", type: "text" })
    kind!: "qa" | "extract" | "draft"

    /** The input. */
    @Column({ name: "input", type: "jsonb" })
    input!: object

    /** The expected. */
    @Column({ name: "expected", type: "jsonb" })
    expected!: object

    /** The origin ref. */
    @Column({ name: "origin_ref", type: "text", nullable: true })
    originRef!: string | null

    /** The created at. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
