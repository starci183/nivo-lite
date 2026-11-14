import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "workflow_trigger_picks" })
/**
 * The founder's pick of the ONE source of a stream for one workflow's trigger purpose (owner key `triggerOneSource2026_11_12`, CORRECTED
 * 2026-11-12): two attached accounts reading one stream wake nothing until one is picked; the other keeps writing raw rows.
 */
export class WorkflowTriggerPickEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The agent whose workflow it is. */
    @Column({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** The workflow (an `agent.workflow` record). */
    @Column({ name: "workflow_id", type: "uuid" })
    workflowId!: string

    /** The trigger purpose (`nivo.trigger.payment.credit.received`). */
    @Column({ name: "verb", type: "text" })
    verb!: string

    /** The stream key, as the engine derives it from the accounts' public facts. */
    @Column({ name: "stream", type: "text" })
    stream!: string

    /** The account picked. */
    @Column({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The member who picked it. */
    @Column({ name: "picked_by", type: "uuid" })
    pickedBy!: string

    /** When it was picked. */
    @Column({ name: "picked_at", type: "timestamptz" })
    pickedAt!: Date
}
