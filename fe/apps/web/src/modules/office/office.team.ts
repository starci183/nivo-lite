import type { OfficeAgent, OfficeLead, OfficePerson, OfficeTask } from "./office.types"

const ROLES: ReadonlyArray<OfficePerson["role"]> = ["owner", "manager", "staff"]
const TASK_STATUSES: ReadonlyArray<OfficeTask["status"]> = ["open", "waiting_approval", "done"]

/** The wire account of the back end `workspaceMembers` query. */
interface MemberWire {
    readonly userId: string
    readonly displayName: string
    readonly avatarUrl?: string | null
    readonly role: string
    readonly status: string
    readonly staffId?: string | null
    readonly lastSignInAt?: string | null
}

/** The active accounts of the workspace as the member panel uses them. */
export const toOfficePeople = (rows: ReadonlyArray<MemberWire>): ReadonlyArray<OfficePerson> =>
    rows
        .filter((row) => row.status === "active")
        .map((row) => ({
            userId: row.userId,
            name: row.displayName,
            avatarUrl: row.avatarUrl ?? null,
            role: ROLES.find((role) => role === row.role) ?? "staff",
            staffId: row.staffId ?? null,
            lastSeen: row.lastSignInAt ?? null,
        }))

/** The wire installation of the back end `moduleInstallations` query. */
interface InstallationWire {
    readonly agentId?: string | null
    readonly agentName: string
    readonly agentHandle: string
    readonly agentAvatarUrl?: string | null
    readonly moduleKey: string
    readonly status: string
    readonly lifecycle: string
    readonly connectionNeeds: ReadonlyArray<{ readonly role: string; readonly providers: ReadonlyArray<string> }>
}

/** The installations that have an agent, as the Office members: live ones are on duty, `needs_connection` ones wait for a connector. */
export const toOfficeAgents = (rows: ReadonlyArray<InstallationWire>): ReadonlyArray<OfficeAgent> =>
    rows.flatMap((row) =>
        row.agentId === undefined || row.agentId === null
            ? []
            : [
                  {
                      id: row.agentId,
                      module: row.moduleKey,
                      name: row.agentName,
                      handle: row.agentHandle,
                      avatarUrl: row.agentAvatarUrl ?? null,
                      isActive: row.lifecycle === "running",
                      lifecycle: row.lifecycle,
                      waitsFor: row.lifecycle === "needs_connection" ? row.connectionNeeds : null,
                  },
              ],
    )

/** The wire responsibility of the back end `responsibilities` query. */
interface TaskWire {
    readonly id: string
    readonly lead_id: string
    readonly title: string
    readonly status: string
    readonly next_action: string
    readonly owner_name: string
    readonly contact_name: string
    readonly due_at?: string | null
}

/** One back end responsibility as the tasks panel uses it. */
export const toOfficeTask = (row: TaskWire): OfficeTask => ({
    id: row.id,
    leadId: row.lead_id,
    title: row.title,
    status: TASK_STATUSES.find((status) => status === row.status) ?? "open",
    nextAction: row.next_action,
    ownerName: row.owner_name,
    leadName: row.contact_name,
    dueAt: row.due_at ?? null,
})

/** The wire lead of the back end `leadBoard` query. */
interface LeadWire {
    readonly id: string
    readonly contactName: string
    readonly nextAction?: string | null
    readonly need: string
    readonly createdAt: string
}

/** One board lead as the customer list uses it. */
export const toOfficeLead = (row: LeadWire): OfficeLead => ({
    id: row.id,
    name: row.contactName,
    preview: row.nextAction ?? (row.need === "" ? null : row.need),
    createdAt: row.createdAt,
})
