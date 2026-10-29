import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ResponsibilityOwnerKind, ResponsibilityStatus } from "../../responsibility-journal.contracts"

@Entity({ schema: "public", name: "responsibilities" })
/** One follow-up step of a customer with its owner and deadline: one row of `public.responsibilities`. */
export class ResponsibilityEntity {
    /** The step. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer the step belongs to. */
    @Column({ name: "lead_id", type: "uuid" })
    leadId!: string

    /** The short label shown on the step card. */
    @Column({ name: "title", type: "text" })
    title!: string

    /** Whether a person or an agent owns the step, a member of the table check. */
    @Column({ name: "owner_kind", type: "text" })
    ownerKind!: ResponsibilityOwnerKind

    /** The owning agent, or null for a person. */
    @Column({ name: "owner_agent_id", type: "uuid", nullable: true })
    ownerAgentId!: string | null

    /** The owning member, or null for an agent; a trigger refills it for a person. */
    @Column({ name: "owner_member_id", type: "uuid", nullable: true })
    ownerMemberId!: string | null

    /** The owner's display name, kept so the card renders without a join. */
    @Column({ name: "owner_name", type: "text" })
    ownerName!: string

    /** The next thing the owner has to do. */
    @Column({ name: "next_action", type: "text" })
    nextAction!: string

    /** When the next step is due, or null without a deadline. */
    @Column({ name: "due_at", type: "timestamptz", nullable: true })
    dueAt!: Date | null

    /** Where the step is, a member of the table check. */
    @Column({ name: "status", type: "text", default: () => "'open'" })
    status!: ResponsibilityStatus

    /** When the step was created. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
