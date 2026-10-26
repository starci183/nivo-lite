import type { DropdownMenuEntry, DropdownMenuSection } from "@starci/grammar/common"
import { ACCOUNT_ITEM, PROFILE_ITEM, SIGN_OUT_ITEM } from "@/modules/types"
import type { ConsoleIconName, ConsoleSession, ConsoleWorkspace } from "@/modules/types"

/** The console route of the Office, the page people come to first. */
export const OFFICE_ROUTE = "/chat"

/** The leads list, where search and the New menu land. */
export const LEADS_ROUTE = "/leads"

/** The catalog key that names each role. */
export const ROLE_LABELS = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** One destination of the console rail. */
export type ConsoleDestination = {
    readonly key: string
    readonly label:
        | "navOverview"
        | "navOffice"
        | "navThreads"
        | "navAuthority"
        | "navInbox"
        | "navLeads"
        | "navResponsibilities"
        | "navDecisions"
        | "navAutomations"
        | "navBrain"
        | "navModules"
        | "navTeam"
        | "navPermissions"
        | "navConnections"
        | "navCredits"
    readonly route: string
    readonly icon: ConsoleIconName
    /** Rail section: the daily work, running the business, setting it up. */
    readonly group: "work" | "operate" | "setup"
    /** Other routes that belong to this destination (documents live under the Brain). */
    readonly also?: ReadonlyArray<string>
    /** Only owner and manager see this destination. */
    readonly managerOnly?: boolean
}

/** Office first: it is the page people come to. The Brain owns the business memory, so its documents are no separate destination. */
export const DESTINATIONS: ReadonlyArray<ConsoleDestination> = [
    { key: "chat", label: "navOffice", route: OFFICE_ROUTE, icon: "community", group: "work" },
    { key: "overview", label: "navOverview", route: "/dashboard", icon: "overview", group: "work" },
    { key: "threads", label: "navThreads", route: "/threads", icon: "review", group: "work" },
    { key: "leads", label: "navLeads", route: LEADS_ROUTE, icon: "account", group: "work" },
    {
        key: "responsibilities",
        label: "navResponsibilities",
        route: "/responsibilities",
        icon: "review",
        group: "work",
    },
    { key: "inbox", label: "navInbox", route: "/inbox", icon: "email", group: "work" },
    { key: "brain", label: "navBrain", route: "/brain", icon: "brain", group: "operate", also: ["/knowledge"] },
    { key: "authority", label: "navAuthority", route: "/authority", icon: "password", group: "operate" },
    { key: "decisions", label: "navDecisions", route: "/decisions", icon: "saved", group: "operate" },
    {
        key: "automations",
        label: "navAutomations",
        route: "/automations",
        icon: "agentos",
        group: "operate",
        managerOnly: true,
    },
    { key: "modules", label: "navModules", route: "/agents", icon: "apps", group: "setup" },
    { key: "team", label: "navTeam", route: "/team", icon: "talents", group: "setup", managerOnly: true },
    {
        key: "permissions",
        label: "navPermissions",
        route: "/permissions",
        icon: "review",
        group: "setup",
        managerOnly: true,
    },
    {
        key: "connections",
        label: "navConnections",
        route: "/connections",
        icon: "servers",
        group: "setup",
        managerOnly: true,
    },
    { key: "credits", label: "navCredits", route: "/billing", icon: "wallet", group: "setup", managerOnly: true },
]

/** The destination a path belongs to; an agent chat belongs to Agents, a path outside the rail to none. */
export const activeDestinationKey = (pathname: string): string | null => {
    if (pathname.startsWith("/modules/") && pathname.includes("/chat")) return "modules"
    const found = DESTINATIONS.find((d) => [d.route, ...(d.also ?? [])].some((route) => pathname.startsWith(route)))
    return found?.key ?? null
}

/** The menu section that switches workspace: the person's workspaces as a single choice, the current one selected (the grammar draws the marker). */
export const workspaceSection = (
    workspaces: ReadonlyArray<ConsoleWorkspace>,
    currentId: string,
    label: string,
    onSwitch: (workspaceId: string) => void,
): DropdownMenuSection => ({
    kind: "section",
    id: "workspaces",
    label,
    items: workspaces.map((workspace) => ({ id: workspace.id, label: workspace.name })),
    selection: {
        mode: "single",
        selectedIds: [currentId],
        onChange: (ids) => {
            const next = ids[0]
            if (next !== undefined) onSwitch(next)
        },
    },
})

/** The session the console frame draws before it is read (the frame waits for the real one). */
export const NO_CONSOLE_SESSION: ConsoleSession = {
    member: { workspaceId: "", userId: "", name: "", role: "staff", staffId: null },
    workspaceName: "",
    userName: "",
    email: "",
    workspaces: [],
    currentWorkspaceId: "",
}

/** Workspace states nobody can work in yet: the owner is sent to the payment step. */
export const UNPAID_WORKSPACE_STATES: ReadonlySet<string> = new Set(["pending_payment", "cancelled"])

/** A membership role as the console reads it. */
export const sessionRoleOf = (role: string): ConsoleWorkspace["role"] =>
    role === "owner" || role === "manager" ? role : "staff"

/** The words of the account menu, resolved by the caller. */
interface AccountEntriesInput {
    readonly workspaces: DropdownMenuSection
    /** The profile page item: its label and the line under it. */
    readonly profile: { readonly label: string; readonly description: string }
    readonly accountLabel: string
    readonly accountDescription: string
    readonly signOutLabel: string
    readonly onSignOut: () => void
}

/** The account menu: the workspaces to switch to, then the profile page, the account page and sign out. */
export const accountEntriesOf = (input: AccountEntriesInput): ReadonlyArray<DropdownMenuEntry> => [
    input.workspaces,
    {
        kind: "section",
        id: "account",
        items: [
            { id: PROFILE_ITEM, label: input.profile.label, description: input.profile.description, href: "/profile" },
            { id: ACCOUNT_ITEM, label: input.accountLabel, description: input.accountDescription, href: "/account" },
            { id: SIGN_OUT_ITEM, label: input.signOutLabel, onAction: input.onSignOut },
        ],
    },
]

/** Translates one key of the shell catalog. */
type ShellWords = (key: string, values?: Record<string, string | number>) => string

/** The words of the notifications bell and its panel for a number of waiting approvals. */
export const notificationsCopyOf = (t: ShellWords, pendingCount: number) => ({
    bell: t("notifications"),
    title: pendingCount === 0 ? t("notifications") : t("pendingTitle", { count: pendingCount }),
    nothingWaiting: t("nothingWaiting"),
    openOffice: t("openOffice"),
})
