import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "automation_commands" })
/** A command a manager screen queued for the back end, with its outcome. */
export class AutomationCommandEntity extends UuidAbstractEntity {
    /** The workspace the manager acts in. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** What was asked. */
    @Column({ name: "kind", type: "text" })
    kind!: "propose_body" | "run_now"

    /** The template the command is about. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** Where the command stands. */
    @Column({ name: "status", type: "text", default: () => "'queued'::text" })
    status!: "queued" | "done" | "failed"

    /** The answer of a command that is done. */
    @Column({ name: "result", type: "jsonb", nullable: true })
    result!: object | null

    /** The reason code of a command that failed. */
    @Column({ name: "fault_code", type: "text", nullable: true })
    faultCode!: string | null

    /** The manager who asked. */
    @Column({ name: "created_by", type: "uuid" })
    createdBy!: string

    /** When the command ended. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
