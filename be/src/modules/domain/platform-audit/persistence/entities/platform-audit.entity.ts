import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "platform_audit" })
/** One row of the audit trail of the platform team's console: one row of `public.platform_audit`. */
export class PlatformAuditEntity {
    /** The row id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

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

    /** When it happened. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
