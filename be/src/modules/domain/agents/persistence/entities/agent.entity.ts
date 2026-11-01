import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "agents" })
/** One agent of a workspace: the persona a department speaks through, with who answers for it. */
export class AgentEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The module key. */
    @Column({ name: "module", type: "text", default: () => "'chatbot'::text" })
    module!: string

    /** The display name. */
    @Column({ name: "name", type: "text" })
    name!: string

    /** The @handle, unique in the workspace. */
    @Column({ name: "handle", type: "text" })
    handle!: string

    /** The one-line role. */
    @Column({ name: "role", type: "text" })
    role!: string

    /** The owner's instructions. */
    @Column({ name: "instructions", type: "text" })
    instructions!: string

    /** The owner's business notes. */
    @Column({ name: "knowledge", type: "text", default: () => "''::text" })
    knowledge!: string

    /** The greeting. */
    @Column({ name: "greeting", type: "text", default: () => "''::text" })
    greeting!: string

    /** The approval rule. */
    @Column({
        name: "approval_rule",
        type: "text",
        default: () => "'Anything that commits price, schedule or scope needs human approval.'::text",
    })
    approvalRule!: string

    /** Whether the agent is active or paused. */
    @Column({ name: "status", type: "text", default: () => "'active'::text" })
    status!: "active" | "paused"

    /** The member in charge, or null for a legacy agent of an ownerless workspace. */
    @Column({ name: "owner_member_id", type: "uuid", nullable: true })
    ownerMemberId!: string | null

    /** The member who takes over, or null for such a legacy agent. */
    @Column({ name: "fallback_member_id", type: "uuid", nullable: true })
    fallbackMemberId!: string | null

    /** The roles that may hand the agent work. */
    @Column({
        name: "assignable_roles",
        type: "text",
        array: true,
        default: () => "ARRAY['owner'::text, 'manager'::text]",
    })
    assignableRoles!: Array<string>

    /** The room keys whose members may hand the agent work. */
    @Column({ name: "assignable_rooms", type: "text", array: true, default: () => "'{}'::text[]" })
    assignableRooms!: Array<string>

    /** The agents it may pass work to. */
    @Column({ name: "can_tag_agent_ids", type: "uuid", array: true, default: () => "'{}'::uuid[]" })
    canTagAgentIds!: Array<string>

    /** The HTTPS address of the picture the owner gave the agent, or null for the generated avatar. */
    @Column({ name: "avatar_url", type: "text", nullable: true })
    avatarUrl!: string | null

    /** The generated id its default name carries ("Agent Chatbot #23233"), unique in the workspace; null for an agent named before it existed. */
    @Column({ name: "serial", type: "integer", nullable: true })
    serial!: number | null
}
