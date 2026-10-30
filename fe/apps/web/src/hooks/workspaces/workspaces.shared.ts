/** The shortest workspace name the form accepts. */
export const WORKSPACE_NAME_MIN = 2

/** The longest workspace name the form accepts. */
export const WORKSPACE_NAME_MAX = 80

/** The business types the form offers, in order (the first is the default); `other` lets the owner type their own words. */
export const WORKSPACE_BUSINESS_TYPES = [
    "spa",
    "retail",
    "cafe",
    "clinic",
    "education",
    "technology",
    "real_estate",
    "manufacturing",
    "logistics",
    "travel",
    "fitness",
    "fashion",
    "finance",
    "agency",
    "construction",
    "services",
    "other",
] as const
/** One business type the form offers. */
export type WorkspaceBusinessType = (typeof WORKSPACE_BUSINESS_TYPES)[number]
/** The option that asks for the owner's own words. */
export const OTHER_BUSINESS_TYPE: WorkspaceBusinessType = "other"
/** The longest business type the owner may type. */
export const BUSINESS_TYPE_MAX = 60
/** The catalog key (`onboarding` namespace) that names each business type. */
export const BUSINESS_TYPE_KEYS: Readonly<Record<WorkspaceBusinessType, string>> = {
    spa: "industrySpa",
    retail: "industryRetail",
    cafe: "industryCafe",
    clinic: "industryClinic",
    education: "industryEducation",
    technology: "industryTechnology",
    real_estate: "industryRealEstate",
    manufacturing: "industryManufacturing",
    logistics: "industryLogistics",
    travel: "industryTravel",
    fitness: "industryFitness",
    fashion: "industryFashion",
    finance: "industryFinance",
    agency: "industryAgency",
    construction: "industryConstruction",
    services: "industryServices",
    other: "industryOther",
}

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
