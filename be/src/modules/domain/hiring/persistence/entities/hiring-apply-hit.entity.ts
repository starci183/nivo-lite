import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "hiring_apply_hits" })
/** One public application attempt, kept for the per-address rate limit. */
export class HiringApplyHitEntity {
    /** The hit; the database numbers it. */
    @PrimaryGeneratedColumn("identity", { name: "id", type: "bigint", generatedIdentity: "ALWAYS" })
    id!: string

    /** The hash of the visitor address. */
    @Column({ name: "ip_hash", type: "text" })
    ipHash!: string

    /** The workspace the page belongs to, when known. */
    @Column({ name: "workspace_id", type: "uuid", nullable: true })
    workspaceId!: string | null

    /** What the visitor did. */
    @Column({ name: "kind", type: "text", default: () => "'apply'::text" })
    kind!: string

    /** When it happened. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
