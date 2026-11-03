import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "template_licenses" })
/** The right of a workspace to run a template: one row per install. */
export class TemplateLicenseEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The template key. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** How the right was got: from the creator own account, free, or paid. */
    @Column({ name: "kind", type: "text" })
    kind!: "private" | "free" | "paid"

    /** The listing it came from, or null. */
    @Column({ name: "listing_id", type: "uuid", nullable: true })
    listingId!: string | null

    /** The paid order, or null. */
    @Column({ name: "order_id", type: "uuid", nullable: true })
    orderId!: string | null

    /** The installation that runs on it, or null while it waits for payment. */
    @Column({ name: "installation_id", type: "uuid", nullable: true })
    installationId!: string | null

    /** The status. */
    @Column({ name: "status", type: "text", default: "active" })
    status!: "pending" | "active" | "expired" | "revoked"
}
