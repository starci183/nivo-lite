/** The shortest workspace name the form accepts. */
export const WORKSPACE_NAME_MIN = 2

/** The longest workspace name the form accepts. */
export const WORKSPACE_NAME_MAX = 80

/** How a workspace stands: usable, waiting for its payment, or switched off. */
export type WorkspaceState = "active" | "pending" | "cancelled"

/** The catalog key (`onboarding` namespace) that names each state. */
export const STATE_KEYS = {
    active: "stateActive",
    pending: "statePending",
    cancelled: "stateCancelled",
} as const

/** The catalog key (`onboarding` namespace) that names each role. */
export const WORKSPACE_ROLE_KEYS = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** One workspace the person belongs to, as the list draws it (plain data). */
export interface WorkspaceCardView {
    readonly id: string
    readonly name: string
    readonly role: "owner" | "manager" | "staff"
    readonly state: WorkspaceState
}

/** The workspace state of the back end status text. */
export const workspaceStateOf = (status: string): WorkspaceState => {
    if (status === "pending_payment") return "pending"
    return status === "cancelled" ? "cancelled" : "active"
}

/** The role of the back end role text. */
export const workspaceRoleOf = (role: string): WorkspaceCardView["role"] =>
    role === "owner" || role === "manager" ? role : "staff"

/** Whether the person may open the workspace: an unpaid one only its owner can pay for. */
export const canOpenWorkspace = (card: WorkspaceCardView): boolean => card.state === "active" || card.role === "owner"

/** Whether the person manages the workspace's plan and payments. */
export const canBillWorkspace = (card: WorkspaceCardView): boolean =>
    card.state === "active" && (card.role === "owner" || card.role === "manager")

const INVITE_IN_LINK = /\/invite\/([^/?#\s]+)/u
const BARE_TOKEN = /^[A-Za-z0-9_-]{16,}$/u

/** The invitation token in a pasted link (or a bare token), or null when the text is neither. */
export const inviteTokenOf = (text: string): string | null => {
    const trimmed = text.trim()
    const inLink = INVITE_IN_LINK.exec(trimmed)?.[1]
    if (inLink !== undefined) return inLink
    return BARE_TOKEN.test(trimmed) ? trimmed : null
}

/** The catalog keys (`onboarding` namespace) of the failure sentences of creating a workspace. */
export type WorkspaceErrorKey = "errName" | "errSignupDisabled" | "errGeneric"

/** The sentence that explains a failure code of creating a workspace. */
export const workspaceErrorKey = (code: string): WorkspaceErrorKey => {
    if (code === "WORKSPACES_SIGNUP_DISABLED") return "errSignupDisabled"
    return code === "WORKSPACES_NAME_INVALID" ? "errName" : "errGeneric"
}
