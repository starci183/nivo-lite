import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ChainStepKind, ChainStepStatus } from "../../work-chains.contracts"

/** The party a step is tagged to, as the jsonb column stores it. */
export interface WorkChainTarget {
    /** member, agent or group. */
    readonly kind: string
    /** The member id, the agent id or the group key. */
    readonly id: string
}

@Entity({ schema: "public", name: "work_chains" })
/** One step of a work thread's chain: who acted, what for, and where the step stands. */
export class WorkChainEntity {
    /** The step id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The thread whose chain the step belongs to. */
    @Column({ name: "thread_id", type: "uuid" })
    threadId!: string

    /** The place of the step in its chain, unique per thread. */
    @Column({ name: "seq", type: "int" })
    seq!: number

    /** member or agent. */
    @Column({ name: "actor_kind", type: "text" })
    actorKind!: "member" | "agent"

    /** The actor id. */
    @Column({ name: "actor_id", type: "uuid" })
    actorId!: string

    /** The step kind. */
    @Column({ name: "kind", type: "text" })
    kind!: ChainStepKind

    /** The short title. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** The line under the title. */
    @Column({ name: "detail", type: "text", default: () => "''" })
    detail!: string

    /** The authority rule, or null. */
    @Column({ name: "rule", type: "text", nullable: true })
    rule!: string | null

    /** The tagged party, or null. */
    @Column({ name: "target", type: "jsonb", nullable: true })
    target!: WorkChainTarget | null

    /** The approval request the step waits on, or null. */
    @Column({ name: "approval_request_id", type: "uuid", nullable: true })
    approvalRequestId!: string | null

    /** Where the step stands. */
    @Column({ name: "status", type: "text", default: () => "'done'" })
    status!: ChainStepStatus

    /** The member who decided, or null. */
    @Column({ name: "decided_by", type: "uuid", nullable: true })
    decidedBy!: string | null

    /** When the step began. */
    @Column({ name: "started_at", type: "timestamptz", default: () => "now()" })
    startedAt!: Date

    /** When the step ended; null while it waits. */
    @Column({ name: "finished_at", type: "timestamptz", nullable: true })
    finishedAt!: Date | null
}
