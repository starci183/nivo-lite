import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "hiring_onboarding" })
/** One step of the onboarding checklist of a hired candidate. */
export class HiringOnboardingEntity {
    /** The step. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace the step belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The candidate the step belongs to. */
    @Column({ name: "candidate_id", type: "uuid" })
    candidateId!: string

    /** What the step asks. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** Whether it is done. */
    @Column({ name: "done", type: "boolean", default: () => "false" })
    done!: boolean

    /** When it was done. */
    @Column({ name: "done_at", type: "timestamptz", nullable: true })
    doneAt!: Date | null

    /** Its place in the list. */
    @Column({ name: "sort", type: "integer", default: () => "0" })
    sort!: number

    /** When it was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
