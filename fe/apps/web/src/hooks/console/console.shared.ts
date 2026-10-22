import type { DropdownMenuItem } from "@starci/grammar/common"
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
        key: "connections",
        label: "navConnections",
        route: "/connections",
        icon: "servers",
        group: "setup",
        managerOnly: true,
    },
    { key: "credits", label: "navCredits", route: "/billing", icon: "wallet", group: "setup", managerOnly: true },
]

/** The destination a path belongs to; an agent chat belongs to Agents, an unknown path to the overview. */
export const activeDestinationKey = (pathname: string): string => {
    if (pathname.startsWith("/modules/") && pathname.includes("/chat")) return "modules"
    const found = DESTINATIONS.find((d) => [d.route, ...(d.also ?? [])].some((route) => pathname.startsWith(route)))
    return found?.key ?? "overview"
}

/** The menu entries that switch workspace: the person's workspaces (the current one ticked). */
export const workspaceEntries = (
    workspaces: ReadonlyArray<ConsoleWorkspace>,
    currentId: string,
    onSwitch: (workspaceId: string) => void,
): ReadonlyArray<DropdownMenuItem> =>
    workspaces.map((workspace) => ({
        id: `ws-${workspace.id}`,
        label: workspace.id === currentId ? `${workspace.name} ✓` : workspace.name,
        onAction: () => onSwitch(workspace.id),
    }))

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
