/** The length of an agent's display name after trimming; the server refuses others. */
export const AGENT_NAME_LIMITS = { min: 2, max: 40 } as const

/** A role an agent may be assigned by, in display order. */
export type AssignRole = "owner" | "manager" | "staff"

const ROLES: ReadonlyArray<AssignRole> = ["owner", "manager", "staff"]

/** One person of the workspace as the page draws them. */
export interface PersonView {
    readonly memberId: string
    readonly name: string
    readonly role: AssignRole
    /** False once the member was disabled. */
    readonly isActive: boolean
}

/** One piece of recent work. */
export interface RecentWorkView {
    readonly id: string
    readonly action: string
    readonly title: string
    readonly customer: string
    readonly status: string
}

/** A region that is read apart from the page: the lines it holds, and whether the server could not read it. */
export interface RegionView<T> {
    readonly isFailed: boolean
    readonly items: ReadonlyArray<T>
}

/** Everything the profile page of an agent draws. */
export interface AgentProfileView {
    readonly id: string
    readonly name: string
    /** The @handle the team mentions; it never changes when the name does. */
    readonly handle: string
    /** The picture the owner gave the agent; null draws the generated avatar of its id. */
    readonly avatarUrl: string | null
    readonly role: string
    readonly module: string
    readonly isActive: boolean
    readonly roomName: string | null
    readonly owner: PersonView | null
    readonly fallback: PersonView | null
    /** The member who answers right now (the owner, else the fallback, else the workspace owner). */
    readonly responderId: string
    readonly assignableRoles: ReadonlyArray<AssignRole>
    readonly assignableRooms: ReadonlyArray<string>
    readonly recent: RegionView<RecentWorkView>
}

/** A person of the wire. */
interface OwnerWire {
    readonly memberId: string
    readonly name: string
    readonly role: string
    readonly active: boolean
}

/** A region of the wire: the lines, absent when the server could not read it. */
interface RegionWire<W> {
    readonly ok: boolean
    readonly data?: ReadonlyArray<W> | null
}

/** The wire answer of the back end `agentPage` query, as far as the page reads it. */
export interface AgentPageWire {
    readonly agent: {
        readonly id: string
        readonly name: string
        readonly handle: string
        readonly avatarUrl?: string | null
        readonly role: string
        readonly module: string
        readonly status: string
        readonly roomName?: string | null
    }
    readonly ownership: {
        readonly owner?: OwnerWire | null
        readonly fallback?: OwnerWire | null
        readonly responder: { readonly ownerMemberId: string }
        readonly assignableRoles: ReadonlyArray<string>
        readonly assignableRooms: ReadonlyArray<{ readonly name: string }>
    }
    readonly recent: RegionWire<{
        readonly id: string
        readonly action: string
        readonly title: string
        readonly customer: string
        readonly status: string
    }>
}

const roleOf = (value: string): AssignRole => ROLES.find((role) => role === value) ?? "staff"

const personOf = (wire: OwnerWire | null | undefined): PersonView | null =>
    wire === null || wire === undefined
        ? null
        : { memberId: wire.memberId, name: wire.name, role: roleOf(wire.role), isActive: wire.active }

/** Reads one region: the lines it holds (a line the page does not know is left out, never guessed), and whether it failed. */
const regionOf = <W, V>(wire: RegionWire<W>, map: (line: W) => V | null): RegionView<V> => {
    if (!wire.ok || wire.data === null || wire.data === undefined) return { isFailed: true, items: [] }
    return { isFailed: false, items: wire.data.flatMap((line) => map(line) ?? []) }
}

/** The page of an agent from the wire answer. */
export const toAgentProfile = (wire: AgentPageWire): AgentProfileView => ({
    id: wire.agent.id,
    name: wire.agent.name,
    handle: wire.agent.handle,
    avatarUrl: wire.agent.avatarUrl ?? null,
    role: wire.agent.role,
    module: wire.agent.module,
    isActive: wire.agent.status === "active",
    roomName: wire.agent.roomName ?? null,
    owner: personOf(wire.ownership.owner),
    fallback: personOf(wire.ownership.fallback),
    responderId: wire.ownership.responder.ownerMemberId,
    assignableRoles: ROLES.filter((role) => wire.ownership.assignableRoles.includes(role)),
    assignableRooms: wire.ownership.assignableRooms.map((room) => room.name),
    recent: regionOf(wire.recent, (work) => ({
        id: work.id,
        action: work.action,
        title: work.title,
        customer: work.customer,
        status: work.status,
    })),
})

/** The identity chips under the name: what the agent is, where it sits, and whether it is paused. */
export type ChipId = "kind" | "room" | "paused"

/** One identity chip: its words are the page's, its room name (when it has one) is data. */
export interface ChipView {
    readonly id: ChipId
    readonly tone: "neutral" | "danger"
    /** The room name for the room chip; null otherwise. */
    readonly room: string | null
}

/** The chips of an agent, in display order. */
export const profileChipsOf = (agent: AgentProfileView): ReadonlyArray<ChipView> => [
    { id: "kind", tone: "neutral", room: null },
    ...(agent.roomName === null ? [] : [{ id: "room" as const, tone: "neutral" as const, room: agent.roomName }]),
    ...(agent.isActive ? [] : [{ id: "paused" as const, tone: "danger" as const, room: null }]),
]
