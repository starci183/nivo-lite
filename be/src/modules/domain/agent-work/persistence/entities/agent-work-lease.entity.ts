import { Column, Entity, PrimaryColumn } from "typeorm"
import { AbstractEntity } from "@modules/platform/database"
import { bigintNumberTransformer } from "@modules/platform/primitives"

@Entity({ schema: "public", name: "agent_work_leases" })
/** The lock of one scope of an agent: a customer conversation, or the agent itself. Only the database functions write it; the back end reads. */
export class AgentWorkLeaseEntity extends AbstractEntity {
    /** The agent. */
    @PrimaryColumn({ name: "agent_id", type: "uuid" })
    agentId!: string

    /** `agent`, or `conversation:<id>`. */
    @PrimaryColumn({ name: "scope_key", type: "text" })
    scopeKey!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** Rises on every turn begun in the scope. */
    @Column({ name: "fence", type: "bigint", transformer: bigintNumberTransformer, default: 0 })
    fence!: number

    /** The worker that holds the lease, or null. */
    @Column({ name: "lease_owner", type: "text", nullable: true })
    leaseOwner!: string | null

    /** When the lease lapses unless renewed, or null. */
    @Column({ name: "lease_until", type: "timestamptz", nullable: true })
    leaseUntil!: Date | null

    /** The turn that runs, or null. */
    @Column({ name: "running_turn_id", type: "uuid", nullable: true })
    runningTurnId!: string | null
}
