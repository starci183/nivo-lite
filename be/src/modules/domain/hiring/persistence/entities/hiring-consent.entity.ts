import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { ApplicationSource } from "../../hiring.contracts"

@Entity({ schema: "public", name: "hiring_consents" })
/** The consent an applicant gave for keeping their application. */
export class HiringConsentEntity extends UuidAbstractEntity {
    /** The workspace the consent belongs to. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The candidate who agreed. */
    @Column({ name: "candidate_id", type: "uuid" })
    candidateId!: string

    /** The channel the consent was given on. */
    @Column({ name: "channel", type: "text" })
    channel!: ApplicationSource

    /** The words the applicant agreed to. */
    @Column({ name: "consent_text", type: "text" })
    consentText!: string

    /** The hash of the applicant address. */
    @Column({ name: "ip_hash", type: "text", nullable: true })
    ipHash!: string | null

    /** When the consent was given. */
    @Column({ name: "given_at", type: "timestamptz", default: () => "now()" })
    givenAt!: Date
}
