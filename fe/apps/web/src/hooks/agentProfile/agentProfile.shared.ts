import { authorityModeOf } from "@/modules/authority"
import type { AuthorityMode } from "@/modules/authority"

/** The longest request the composer sends; the server refuses more. */
export const ASSIGN_TEXT_MAX = 2000

/** A role an agent may be assigned by, in display order. */
export type AssignRole = "owner" | "manager" | "staff"

const ROLES: ReadonlyArray<AssignRole> = ["owner", "manager", "staff"]
const OPERATING_MODES = ["assist", "autopilot"] as const

/** One person of the workspace as the page draws them. */
export interface PersonView {
    readonly memberId: string
    readonly name: string
    readonly role: AssignRole
    /** False once the member was disabled. */
    readonly isActive: boolean
}

/** One rule of the owner's authority that applies to the agent. */
export interface AppliedRuleView {
    readonly action: string
    readonly mode: AuthorityMode
    readonly note: string
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
    readonly name: string
    readonly role: string
    readonly module: string
    readonly isActive: boolean
    readonly roomName: string | null
    /** assist asks first, autopilot works alone; null when no instance drives the agent. */
    readonly mode: "assist" | "autopilot" | null
    readonly owner: PersonView | null
    readonly fallback: PersonView | null
    /** The member who answers right now (the owner, else the fallback, else the workspace owner). */
    readonly responderId: string
    readonly assignableRoles: ReadonlyArray<AssignRole>
    readonly assignableRooms: ReadonlyArray<string>
    readonly canTag: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly module: string
        readonly isActive: boolean
    }>
    readonly rules: RegionView<AppliedRuleView>
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
        readonly name: string
        readonly role: string
        readonly module: string
        readonly status: string
        readonly roomName?: string | null
        readonly operatingMode?: string | null
    }
    readonly ownership: {
        readonly owner?: OwnerWire | null
        readonly fallback?: OwnerWire | null
        readonly responder: { readonly ownerMemberId: string }
        readonly assignableRoles: ReadonlyArray<string>
        readonly assignableRooms: ReadonlyArray<{ readonly name: string }>
        readonly canTag: ReadonlyArray<{
            readonly id: string
            readonly name: string
            readonly module: string
            readonly status: string
        }>
    }
    readonly rules: RegionWire<{ readonly action: string; readonly mode: string; readonly note: string }>
    readonly recent: RegionWire<{
        readonly id: string
        readonly action: string
        readonly title: string
        readonly customer: string
        readonly status: string
    }>
}

const roleOf = (value: string): AssignRole => ROLES.find((role) => role === value) ?? "staff"

const modeOf = (value: string | null | undefined): AgentProfileView["mode"] =>
    OPERATING_MODES.find((mode) => mode === value) ?? null

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
    name: wire.agent.name,
    role: wire.agent.role,
    module: wire.agent.module,
    isActive: wire.agent.status === "active",
    roomName: wire.agent.roomName ?? null,
    mode: modeOf(wire.agent.operatingMode),
    owner: personOf(wire.ownership.owner),
    fallback: personOf(wire.ownership.fallback),
    responderId: wire.ownership.responder.ownerMemberId,
    assignableRoles: ROLES.filter((role) => wire.ownership.assignableRoles.includes(role)),
    assignableRooms: wire.ownership.assignableRooms.map((room) => room.name),
    canTag: wire.ownership.canTag.map((target) => ({
        id: target.id,
        name: target.name,
        module: target.module,
        isActive: target.status === "active",
    })),
    rules: regionOf(wire.rules, (rule) => {
        const mode = authorityModeOf(rule.mode)
        return mode === null ? null : { action: rule.action, mode, note: rule.note }
    }),
    recent: regionOf(wire.recent, (work) => ({
        id: work.id,
        action: work.action,
        title: work.title,
        customer: work.customer,
        status: work.status,
    })),
})

/** The identity chips under the name: what the agent is, where it sits, how far it goes alone, and whether it is paused. */
export type ChipId = "kind" | "room" | "assist" | "autopilot" | "paused"

/** One identity chip: its words are the page's, its room name (when it has one) is data. */
export interface ChipView {
    readonly id: ChipId
    readonly tone: "neutral" | "warning" | "success" | "danger"
    /** The room name for the room chip; null otherwise. */
    readonly room: string | null
}

const MODE_CHIPS: Readonly<Record<"assist" | "autopilot", ChipView>> = {
    assist: { id: "assist", tone: "warning", room: null },
    autopilot: { id: "autopilot", tone: "success", room: null },
}

/** The chips of an agent, in display order. */
export const profileChipsOf = (agent: AgentProfileView): ReadonlyArray<ChipView> => [
    { id: "kind", tone: "neutral", room: null },
    ...(agent.roomName === null ? [] : [{ id: "room" as const, tone: "neutral" as const, room: agent.roomName }]),
    ...(agent.mode === null ? [] : [MODE_CHIPS[agent.mode]]),
    ...(agent.isActive ? [] : [{ id: "paused" as const, tone: "danger" as const, room: null }]),
]
