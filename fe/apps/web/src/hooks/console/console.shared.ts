import type { DropdownMenuEntry, DropdownMenuSection } from "@starci/grammar/common"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import {
    ACCOUNT_ITEM,
    PROFILE_ITEM,
    SIGN_OUT_ITEM,
    type ConsoleIconName,
    type ConsoleSessionView,
    type ConsoleWorkspace,
} from "@/modules/types"

/** The catalog key that names each role. */
export const ROLE_LABELS = { owner: "roleOwner", manager: "roleManager", staff: "roleStaff" } as const

/** One destination of the console rail. */
export type ConsoleDestination = {
    readonly key: string
    readonly label:
        | "navOverview"
        | "navContacts"
        | "navChat"
        | "navBrain"
        | "navModules"
        | "navTeam"
        | "navConnections"
        | "navCredits"
        | "navSettings"
        | "navDevelopers"
    readonly route: string
    readonly icon: ConsoleIconName
    /** Rail section: the daily work, running the business, setting it up. */
    readonly group: "work" | "operate" | "setup"
    /** Other routes that belong to this destination (documents live under the Brain). */
    readonly also?: ReadonlyArray<string>
    /** Only owner and manager see this destination. */
    readonly managerOnly?: boolean
}

/** The Brain owns the business memory, so its documents are no separate destination. */
export const DESTINATIONS: ReadonlyArray<ConsoleDestination> = [
    { key: "overview", label: "navOverview", route: "/overview", icon: "overview", group: "work", managerOnly: true },
    {
        key: "contacts",
        label: "navContacts",
        route: "/contacts",
        icon: "community",
        group: "work",
        managerOnly: true,
    },
    { key: "chat", label: "navChat", route: "/chat", icon: "chat", group: "work" },
    { key: "brain", label: "navBrain", route: "/brain", icon: "brain", group: "operate", also: ["/knowledge"] },
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
    { key: "settings", label: "navSettings", route: "/settings", icon: "settings", group: "setup", managerOnly: true },
    {
        key: "developers",
        label: "navDevelopers",
        route: "/developers",
        icon: "developers",
        group: "setup",
        managerOnly: true,
    },
]

/** The destination a path inside the workspace belongs to; a path outside the rail to none. */
export const activeDestinationKey = (path: string): string | null => {
    const found = DESTINATIONS.find((d) => [d.route, ...(d.also ?? [])].some((route) => path.startsWith(route)))
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
export const NO_CONSOLE_SESSION: ConsoleSessionView = {
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
    /** The workspace the profile and account pages are opened in. */
    readonly workspaceId: string
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
            {
                id: PROFILE_ITEM,
                label: input.profile.label,
                description: input.profile.description,
                href: workspaceHref(input.workspaceId, APP_ROUTES.profile),
            },
            {
                id: ACCOUNT_ITEM,
                label: input.accountLabel,
                description: input.accountDescription,
                href: workspaceHref(input.workspaceId, APP_ROUTES.account),
            },
            { id: SIGN_OUT_ITEM, label: input.signOutLabel, onAction: input.onSignOut },
        ],
    },
]
