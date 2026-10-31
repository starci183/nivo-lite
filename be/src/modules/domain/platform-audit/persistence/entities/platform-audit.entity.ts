import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "platform_audit" })
/** One row of the audit trail of the platform team's console: one row of `public.platform_audit`. */
export class PlatformAuditEntity extends UuidAbstractEntity {
    /** The admin email. */
    @Column({ name: "actor_email", type: "text" })
    actorEmail!: string

    /** The admin account, when known. */
    @Column({ name: "actor_id", type: "uuid", nullable: true })
    actorId!: string | null

    /** What happened. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** The workspace it concerned, when any. */
    @Column({ name: "workspace_id", type: "uuid", nullable: true })
    workspaceId!: string | null

    /** What the action carried. */
    @Column({ name: "data", type: "jsonb", default: () => "'{}'::jsonb" })
    data!: object
}
