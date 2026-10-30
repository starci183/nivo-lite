import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "zalo_wizard_drafts" })
/** The keys the Zalo wizard handed over for a connection while the back end seals them. */
export class ZaloWizardDraftEntity extends AbstractEntity {
    /** The connection the keys belong to. */
    @PrimaryColumn({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The Zalo app id. */
    @Column({ name: "app_id", type: "text", nullable: true })
    appId!: string | null

    /** The Zalo app secret. */
    @Column({ name: "app_secret", type: "text", nullable: true })
    appSecret!: string | null

    /** The OA Secret Key. */
    @Column({ name: "oa_secret", type: "text", nullable: true })
    oaSecret!: string | null
}
