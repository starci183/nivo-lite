import { Column, Entity, PrimaryColumn } from "typeorm"

import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "video_brand_kits" })
/** The video brand kit of one workspace: colors, logo, music and voice. */
export class VideoBrandKitEntity extends AbstractEntity {
    /** The workspace the kit belongs to. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The shop name. */
    @Column({ name: "shop_name", type: "text", default: "" })
    shopName!: string

    /** The main color. */
    @Column({ name: "primary_color", type: "text", default: "#16a34a" })
    primaryColor!: string

    /** The second color. */
    @Column({ name: "secondary_color", type: "text", default: "#0f172a" })
    secondaryColor!: string

    /** The logo path in the media bucket. */
    @Column({ name: "logo_path", type: "text", nullable: true })
    logoPath!: string | null

    /** The music track. */
    @Column({ name: "music_track", type: "text", nullable: true })
    musicTrack!: string | null

    /** The voice name. */
    @Column({ name: "voice", type: "text", default: "vi-VN-HoaiMyNeural" })
    voice!: string

    /** The last editor. */
    @Column({ name: "updated_by", type: "uuid", nullable: true })
    updatedBy!: string | null
}
