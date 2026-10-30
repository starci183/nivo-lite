import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "hiring_settings" })
/** The hiring choices of a workspace: the public link, the retention, the reminders and the consent words. */
export class HiringSettingEntity extends AbstractEntity {
    /** The workspace the settings belong to. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The public slug of the job pages, unique across workspaces. */
    @Column({ name: "public_slug", type: "text" })
    publicSlug!: string

    /** Days a rejected or withdrawn candidate is kept. */
    @Column({ name: "retention_days", type: "integer", default: () => "90" })
    retentionDays!: number

    /** Announce new candidates in the Office. */
    @Column({ name: "notify_new_candidate", type: "boolean", default: () => "true" })
    notifyNewCandidate!: boolean

    /** Remind interviews. */
    @Column({ name: "remind_interview", type: "boolean", default: () => "true" })
    remindInterview!: boolean

    /** Close a job once it is filled. */
    @Column({ name: "auto_close_when_filled", type: "boolean", default: () => "true" })
    autoCloseWhenFilled!: boolean

    /** The words an applicant agrees to. */
    @Column({
        name: "apply_consent_text",
        type: "text",
        default: () =>
            "'T\u00f4i \u0111\u1ed3ng \u00fd \u0111\u1ec3 doanh nghi\u1ec7p l\u01b0u h\u1ed3 s\u01a1 v\u00e0 th\u00f4ng tin t\u00f4i cung c\u1ea5p \u0111\u1ec3 x\u00e9t tuy\u1ec3n. H\u1ed3 s\u01a1 ch\u1ec9 d\u00f9ng cho vi\u1ec7c tuy\u1ec3n d\u1ee5ng v\u00e0 \u0111\u01b0\u1ee3c x\u00f3a khi h\u1ebft th\u1eddi h\u1ea1n l\u01b0u tr\u1eef ho\u1eb7c khi t\u00f4i y\u00eau c\u1ea7u.'::text",
    })
    applyConsentText!: string

    /** The tone of the generated ads. */
    @Column({
        name: "ad_tone",
        type: "text",
        default: () => "'th\u00e2n thi\u1ec7n, r\u00f5 r\u00e0ng, t\u00f4n tr\u1ecdng'::text",
    })
    adTone!: string
}
