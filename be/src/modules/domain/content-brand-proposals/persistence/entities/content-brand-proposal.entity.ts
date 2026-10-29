import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "content_brand_proposals" })
/** One row of public.content_brand_proposals. */
export class ContentBrandProposalEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The installation id. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null

    /** The setup session id. */
    @Column({ name: "setup_session_id", type: "uuid", nullable: true })
    setupSessionId!: string | null

    /** The file name. */
    @Column({ name: "file_name", type: "text" })
    fileName!: string

    /** The file size. */
    @Column({ name: "file_size", type: "int", default: () => "0" })
    fileSize!: number

    /** The payload. */
    @Column({ name: "payload", type: "jsonb" })
    payload!: object

    /** The status. */
    @Column({ name: "status", type: "text", default: () => "'proposed'::text" })
    status!: "proposed" | "applied" | "rejected"

    /** The decided by. */
    @Column({ name: "decided_by", type: "text", nullable: true })
    decidedBy!: string | null

    /** The decided at. */
    @Column({ name: "decided_at", type: "timestamptz", nullable: true })
    decidedAt!: Date | null

    /** The created at. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
