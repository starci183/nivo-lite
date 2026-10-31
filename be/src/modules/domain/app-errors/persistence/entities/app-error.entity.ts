import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "app_errors" })
/** One unexpected failure captured for the team console. */
export class AppErrorEntity extends UuidAbstractEntity {
    /** Where it happened (a scope such as `api.leads`). */
    @Column({ name: "scope", type: "text" })
    scope!: string

    /** The message. */
    @Column({ name: "message", type: "text" })
    message!: string

    /** The stack, when one was captured. */
    @Column({ name: "stack", type: "text", nullable: true })
    stack!: string | null

    /** The workspace the failure belongs to, when known. */
    @Column({ name: "workspace_id", type: "uuid", nullable: true })
    workspaceId!: string | null

    /** The context the failure was captured with. */
    @Column({ name: "ctx", type: "jsonb", default: () => "'{}'::jsonb" })
    ctx!: Readonly<Record<string, unknown>>
}
