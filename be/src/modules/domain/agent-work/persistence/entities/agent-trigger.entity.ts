import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"
import type { AgentTriggerKind, AgentTriggerPreset } from "../../agent-work.contracts"

@Entity({ schema: "public", name: "agent_triggers" })
/** When an agent wakes by itself: on a clock preset or on an internal event. The row is the truth; the scheduler in Redis is a projection of it. */
export class AgentTriggerEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** `schedule` or `event`; constrained by a CHECK. */
    @Column({ name: "kind", type: "text" })
    kind!: AgentTriggerKind

    /** The clock preset of a schedule, or null. */
    @Column({ name: "preset", type: "text", nullable: true })
    preset!: AgentTriggerPreset | null

    /** The time of day (`HH:MM:SS`) of a daily preset, or null. */
    @Column({ name: "at_time", type: "time", nullable: true })
    atTime!: string | null

    /** The zone of the time of day. */
    @Column({ name: "time_zone", type: "text", default: () => "'Asia/Ho_Chi_Minh'" })
    timeZone!: string

    /** The internal event of an event trigger, or null. */
    @Column({ name: "event_name", type: "text", nullable: true })
    eventName!: string | null

    /** The probe that decides whether a wake has work, or null for always. */
    @Column({ name: "probe_key", type: "text", nullable: true })
    probeKey!: string | null

    /** Off keeps the row and fires nothing. */
    @Column({ name: "enabled", type: "boolean", default: true })
    enabled!: boolean

    /** The next slot the scheduler holds, or null. */
    @Column({ name: "next_run_at", type: "timestamptz", nullable: true })
    nextRunAt!: Date | null

    /** The last slot that fired, or null. */
    @Column({ name: "last_fired_at", type: "timestamptz", nullable: true })
    lastFiredAt!: Date | null

    /** When the scheduler was last made to agree with this row, or null. */
    @Column({ name: "reconciled_at", type: "timestamptz", nullable: true })
    reconciledAt!: Date | null
}
