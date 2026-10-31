import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"
import type { AgentRoad } from "../../agent-work.contracts"

@Entity({ schema: "public", name: "agent_work_settings" })
/** The agent work settings of a workspace: its kill switch, the road of customer intake and the cap of background turns per agent. */
export class AgentWorkSettingsEntity extends AbstractEntity {
    /** The workspace. */
    @PrimaryColumn({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** False when work is switched off for every agent of the workspace. */
    @Column({ name: "work_enabled", type: "boolean", default: true })
    workEnabled!: boolean

    /** `legacy` answers customers through the chat-turn queue, `core` through a wake. */
    @Column({ name: "road", type: "text", default: () => "'core'" })
    road!: AgentRoad

    /** The most background turns one agent may run per day. */
    @Column({ name: "background_daily_cap", type: "integer", default: 200 })
    backgroundDailyCap!: number

    /** The member who switched work off, or null. */
    @Column({ name: "paused_by", type: "uuid", nullable: true })
    pausedBy!: string | null

    /** When work was switched off, or null. */
    @Column({ name: "paused_at", type: "timestamptz", nullable: true })
    pausedAt!: Date | null
}
