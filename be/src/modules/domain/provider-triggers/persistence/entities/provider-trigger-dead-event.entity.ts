import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { TriggerRole } from "../../provider-triggers.contracts"

@Entity({ schema: "public", name: "provider_trigger_dead_events" })
/** One row of public.provider_trigger_dead_events: a run a trigger could not start for an agent after its retries; kept, never dropped. */
export class ProviderTriggerDeadEventEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The connected account that emitted. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The trigger name. */
    @Column({ name: "trigger_name", type: "text" })
    triggerName!: string

    /** The agent the run was for. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The part the agent had. */
    @Column({ name: "role", type: "text" })
    role!: TriggerRole

    /** The key of the wake that could not be written: one row per key. */
    @Column({ name: "event_key", type: "text" })
    eventKey!: string

    /** Why, as a code. */
    @Column({ name: "reason", type: "text" })
    reason!: string

    /** The params of the run: ids and counts only. */
    @Column({ name: "params", type: "jsonb" })
    params!: object
}
