import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import type { DeciderKind, DecisionOutcome, Proposal } from "../../decisions.contracts"

@Entity({ schema: "public", name: "decisions" })
/** One row of public.decisions: an append-only line of the decision log, who decided what about a work item. */
export class DecisionEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The work item it decided, when there is one. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The customer, when the decision concerns one. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The module whose work was decided. */
    @Column({ name: "department", type: "text" })
    department!: string

    /** The action key. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** Who decided: a person's name or NIVO. */
    @Column({ name: "decided_by", type: "text" })
    decidedBy!: string

    /** Policy, owner or staff (a CHECK in the table). */
    @Column({ name: "decider_kind", type: "text" })
    deciderKind!: DeciderKind

    /** The outcome (a CHECK in the table). */
    @Column({ name: "outcome", type: "text" })
    outcome!: DecisionOutcome

    /** Why the gate asked. */
    @Column({ name: "reason", type: "text", nullable: true })
    reason!: string | null

    /** The decider's note. */
    @Column({ name: "note", type: "text", nullable: true })
    note!: string | null

    /** The proposal before the decision. */
    @Column({ name: "before", type: "jsonb", nullable: true })
    before!: Proposal | null

    /** The proposal after the decision. */
    @Column({ name: "after", type: "jsonb", nullable: true })
    after!: Proposal | null

    /** The member who decided; null for a policy decision and for lines written before members were named. */
    @Column({ name: "decided_by_member_id", type: "uuid", nullable: true })
    decidedByMemberId!: string | null
}
