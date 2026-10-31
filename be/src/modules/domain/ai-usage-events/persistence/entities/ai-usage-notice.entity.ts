import { AbstractEntity } from "@modules/platform/database"
import { Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "ai_usage_notices" })
/** One quota notice already sent for a workspace and billing period, so it is sent once: one row of `public.ai_usage_notices`. */
export class AiUsageNoticeEntity extends AbstractEntity {
    /** The workspace that was told. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The billing period (first day, YYYY-MM-DD). */
    @PrimaryColumn({ name: "period", type: "date" })
    period!: string

    /** warn or exceeded. */
    @PrimaryColumn({ name: "level", type: "text" })
    level!: string
}
