import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "agent_work_state" })
/** The work state of one agent: its kill switch, its breaker and the day's count of background turns. The database functions keep the counters. */
export class AgentWorkStateEntity extends AbstractEntity {
    /** The agent. */
    @PrimaryColumn({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** False when work is switched off for this agent. */
    @Column({ name: "work_enabled", type: "boolean", default: true })
    workEnabled!: boolean

    /** The member who switched work off, or null. */
    @Column({ name: "paused_by", type: "uuid", nullable: true })
    pausedBy!: string | null

    /** When work was switched off, or null. */
    @Column({ name: "paused_at", type: "timestamptz", nullable: true })
    pausedAt!: Date | null

    /** Failed turns in a row. */
    @Column({ name: "failures", type: "integer", default: 0 })
    failures!: number

    /** Until when background wakes wait and customer wakes go to the holding line, or null. */
    @Column({ name: "breaker_until", type: "timestamptz", nullable: true })
    breakerUntil!: Date | null

    /** When the last turn ended, or null. */
    @Column({ name: "last_turn_at", type: "timestamptz", nullable: true })
    lastTurnAt!: Date | null

    /** The day (`YYYY-MM-DD`, Ho Chi Minh) of the background count, or null. */
    @Column({ name: "background_day", type: "date", nullable: true })
    backgroundDay!: string | null

    /** Background turns counted on that day. */
    @Column({ name: "background_turns", type: "integer", default: 0 })
    backgroundTurns!: number
}
