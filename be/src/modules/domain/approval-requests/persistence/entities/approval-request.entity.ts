import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import { numeric } from "./numeric-column.mapper"
import type { ApprovalPolicy, RuleUnit } from "@modules/domain/authority-rules"
import type { ApproverRef } from "@modules/domain/member-grants"
import type { ApprovalExclusion, ApprovalStatus, ApprovalVerdictRecord } from "../../approval-requests.contracts"

@Entity({ schema: "public", name: "approval_requests" })
/** One request for approval of one chain step, with the verdicts members gave it; the single row every verdict locks. */
export class ApprovalRequestEntity extends UuidAbstractEntity {
    /** The chain step it asks about; a step has at most one pending request. */
    @Column({ name: "chain_step_id", type: "uuid" })
    chainStepId!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module of the action. */
    @Column({ name: "department", type: "text" })
    department!: string

    /** The action. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** The amount, or null. */
    @Column({ name: "amount", type: "numeric", nullable: true, transformer: numeric })
    amount!: number | null

    /** What the amount is counted in. */
    @Column({ name: "unit", type: "text", default: () => "'vnd'::text" })
    unit!: RuleUnit

    /** The agent that asked, or null. */
    @Column({ name: "requested_by_agent_id", type: "uuid", nullable: true })
    requestedByAgentId!: string | null

    /** How the approvers decide. */
    @Column({ name: "policy", type: "text" })
    policy!: ApprovalPolicy

    /** Where the request stands. */
    @Column({ name: "status", type: "text", default: () => "'pending'::text" })
    status!: ApprovalStatus

    /** Who was asked when it opened, in the order a sequential policy asks them. */
    @Column({ name: "approvers", type: "jsonb", default: () => "'[]'::jsonb" })
    approvers!: Array<ApproverRef>

    /** Who was left out, and why. */
    @Column({ name: "excluded", type: "jsonb", default: () => "'[]'::jsonb" })
    excluded!: Array<ApprovalExclusion>

    /** The verdicts given so far, in the order they were given. */
    @Column({ name: "verdicts", type: "jsonb", default: () => "'[]'::jsonb" })
    verdicts!: Array<ApprovalVerdictRecord>

    /** Minutes before it runs out. */
    @Column({ name: "timeout_minutes", type: "integer" })
    timeoutMinutes!: number

    /** When it runs out. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date

    /** When the approvers were reminded, or null. */
    @Column({ name: "reminded_at", type: "timestamptz", nullable: true })
    remindedAt!: Date | null

    /** The member who settled it, or null. */
    @Column({ name: "resolved_by", type: "uuid", nullable: true })
    resolvedBy!: string | null

    /** When it was settled, or null. */
    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null

    /** The member it went to when it expired, or null. */
    @Column({ name: "escalated_to", type: "uuid", nullable: true })
    escalatedTo!: string | null
}
