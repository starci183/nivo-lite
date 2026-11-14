import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "provider_trigger_switches" })
/** One row of public.provider_trigger_switches: the switch of one trigger on one connected account, and who decides on its events. */
export class ProviderTriggerSwitchEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connected account. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The trigger name inside the account's provider. */
    @Column({ name: "trigger_name", type: "text" })
    triggerName!: string

    /** Whether the trigger is on; a row is written only when the owner first touches the switch, so no row is off. */
    @Column({ name: "enabled", type: "boolean", default: false })
    enabled!: boolean

    /** The start point: events the provider dates before it are not handed on. Null takes every event. */
    @Column({ name: "enabled_at", type: "timestamptz", nullable: true })
    enabledAt!: Date | null

    /** The agent the owner bound as the decider; one column, so one account trigger never has two. */
    @Column({ name: "decider_agent_id", type: "uuid", nullable: true })
    deciderAgentId!: string | null

    /** When the trigger last handed an event on. */
    @Column({ name: "last_fired_at", type: "timestamptz", nullable: true })
    lastFiredAt!: Date | null

    /** How many events it handed on. */
    @Column({ name: "fired_count", type: "integer", default: 0 })
    firedCount!: number
}
