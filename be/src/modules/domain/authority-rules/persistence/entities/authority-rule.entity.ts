import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { WorkspaceRole } from "@modules/domain/workspace-members"
import type { ApprovalPolicy, RuleMode, RuleUnit } from "../../authority-rules.contracts"

/** Reads a bigint or numeric column as the number the contracts carry, and writes it as it is. */
const numeric = {
    to: (value: number | null): number | null => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "authority_rules" })
/** What the owner granted one action of a department: its mode, bands, approvers and the agents it applies to. */
export class AuthorityRuleEntity {
    /** The rule id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module the action belongs to. */
    @Column({ name: "department", type: "text" })
    department!: string

    /** The action key. */
    @Column({ name: "action", type: "text" })
    action!: string

    /** Auto, ask or never. */
    @Column({ name: "mode", type: "text", default: () => "'ask'::text" })
    mode!: RuleMode

    /** The legacy limit in VND. */
    @Column({ name: "limit_vnd", type: "bigint", nullable: true, transformer: numeric })
    limitVnd!: number | null

    /** Fields that must be present. */
    @Column({ name: "required_fields", type: "text", array: true, default: () => "'{}'::text[]" })
    requiredFields!: Array<string>

    /** A note on the rule. */
    @Column({ name: "note", type: "text", default: () => "''::text" })
    note!: string

    /** When the rule was saved last. */
    @Column({ name: "updated_at", type: "timestamptz", default: () => "now()" })
    updatedAt!: Date

    /** What the amount is counted in. */
    @Column({ name: "unit", type: "text", default: () => "'vnd'::text" })
    unit!: RuleUnit

    /** The action runs alone up to this amount; null means no auto band. */
    @Column({ name: "auto_max", type: "numeric", nullable: true, transformer: numeric })
    autoMax!: number | null

    /** A person is asked up to this amount; null means no upper bound. */
    @Column({ name: "ask_max", type: "numeric", nullable: true, transformer: numeric })
    askMax!: number | null

    /** Roles whose members may approve. */
    @Column({
        name: "approver_roles",
        type: "text",
        array: true,
        default: () => "ARRAY['owner'::text, 'manager'::text]",
    })
    approverRoles!: Array<WorkspaceRole>

    /** Rooms whose people may approve. */
    @Column({ name: "approver_rooms", type: "text", array: true, default: () => "'{}'::text[]" })
    approverRooms!: Array<string>

    /** Members named as approvers. */
    @Column({ name: "approver_members", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    approverMembers!: Array<string>

    /** How several approvers decide. */
    @Column({ name: "approval_policy", type: "text", default: () => "'any'::text" })
    approvalPolicy!: ApprovalPolicy

    /** Minutes before the request escalates. */
    @Column({ name: "timeout_minutes", type: "integer", default: () => "30" })
    timeoutMinutes!: number

    /** The agents the rule applies to; empty means the whole department. */
    @Column({ name: "agents", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    agents!: Array<string>
}
