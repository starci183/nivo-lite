/** The ownership columns of public.agents. */
export interface OwnershipRow {
    /** The agent. */
    id: string
    /** The workspace. */
    workspace_id: string
    /** The agent's display name. */
    name: string
    /** active or paused. */
    status: "active" | "paused"
    /** The member in charge; null only for a legacy agent of an ownerless workspace. */
    owner_member_id: string | null
    /** The member who takes over; null only for such a legacy agent. */
    fallback_member_id: string | null
    /** The roles that may hand the agent work. */
    assignable_roles: Array<string>
    /** The room keys whose members may hand the agent work. */
    assignable_rooms: Array<string>
    /** The agents it may pass work to. */
    can_tag_agent_ids: Array<string>
}

/** One member that can answer today. */
export interface ActiveMemberRow {
    /** The member (workspace_members.id). */
    id: string
}

/** One member's id, or null when there is none. */
export interface MemberIdRow {
    /** The member (workspace_members.id), or null when the workspace has none. */
    id: string | null
}

/** One member of a workspace with the first department room they sit in. */
export interface MemberStateRow {
    /** The member. */
    id: string
    /** The display name. */
    display_name: string
    /** The workspace role. */
    role: "owner" | "manager" | "staff"
    /** active or disabled. */
    status: "active" | "disabled"
    /** The key of the first room they sit in, or null. */
    room_key: string | null
}

/** What deciding whether a member may hand an agent work needs. */
export interface AssignContextRow {
    /** The member's role. */
    role: string
    /** active or disabled. */
    member_status: string
    /** active or paused. */
    agent_status: string
    /** The roles that may hand the agent work. */
    assignable_roles: Array<string>
    /** The room keys whose members may hand the agent work. */
    assignable_rooms: Array<string>
    /** The keys of every room the member sits in. */
    member_rooms: Array<string>
}

/** What deciding whether one agent may tag another needs. */
export interface TagContextRow {
    /** The tagging agent's status. */
    from_status: string
    /** The tagged agent's status. */
    to_status: string
    /** True when both belong to the same workspace. */
    same_workspace: boolean
    /** True when the tagged agent is on the tagging agent's list. */
    listed: boolean
    /** True when both are the same agent. */
    same_agent: boolean
}

/** One department room. */
export interface RoomLabelRow {
    /** The room key. */
    key: string
    /** The display name. */
    name: string
}

/** One agent as the tag list names it. */
export interface TagTargetRow {
    /** The agent. */
    id: string
    /** The display name. */
    name: string
    /** The module. */
    module: string
    /** active or paused. */
    status: string
}

/** A count. */
export interface CountRow {
    /** How many rows matched. */
    n: number
}
