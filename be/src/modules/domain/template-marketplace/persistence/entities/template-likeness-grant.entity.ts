import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "template_likeness_grants" })
/** The consent of a real person to a persona of a template. */
export class TemplateLikenessGrantEntity extends UuidAbstractEntity {
    /** The template key. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** The person. */
    @Column({ name: "person_name", type: "text" })
    personName!: string

    /** What of them the agent may use. */
    @Column({ name: "allowed_uses", type: "jsonb" })
    allowedUses!: Array<"name" | "avatar" | "voice_style" | "first_person">

    /** The line shown to every customer. */
    @Column({ name: "disclosure", type: "text" })
    disclosure!: string

    /** Who recorded the consent. */
    @Column({ name: "granted_by", type: "uuid" })
    grantedBy!: string

    /** The reviewer who checked the identity of the person, or null. */
    @Column({ name: "verified_by", type: "uuid", nullable: true })
    verifiedBy!: string | null

    /** When the identity was checked. */
    @Column({ name: "verified_at", type: "timestamptz", nullable: true })
    verifiedAt!: Date | null

    /** When the consent ends, or null. */
    @Column({ name: "expires_at", type: "timestamptz", nullable: true })
    expiresAt!: Date | null

    /** When the person took the consent back, or null. */
    @Column({ name: "revoked_at", type: "timestamptz", nullable: true })
    revokedAt!: Date | null
}
