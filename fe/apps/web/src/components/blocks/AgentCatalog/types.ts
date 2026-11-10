import type { DataSlot, SlotLabels } from "@/modules/types"

/** One connection granted to an agent, already in the reader language. */
export interface GrantChipView {
    readonly id: string
    /** The provider mark, or null when the provider has none. */
    readonly logo: string | null
    /** The provider as people know it ("SePay", "Telegram", "Zalo OA"). */
    readonly brand: string
    readonly label: string
}

/** What one installed agent shows as a row of the list. */
export interface AgentRowView {
    readonly key: string
    readonly name: string
    /** The 3D emblem of the kind of agent. */
    readonly emblem: string
    /** The key of the kind, the name the emblem avatar carries. */
    readonly emblemKind: string
    /** The agent's own picture (an upload or a preset image); null draws the default sprout, or the initials. */
    readonly picture: string | null
    /** The owner chose the initials preset. */
    readonly isInitials: boolean
    /** The seed of its generated colour. */
    readonly seed: string
    /** "@handle". */
    readonly subtitle: string
    readonly grants: ReadonlyArray<GrantChipView>
    readonly countLabel: string
    readonly overflowLabel: string
    readonly menuLabel: string
    /** Where "Grant access" and the last menu item go. */
    readonly grantHref: string
    readonly knowledgeLine: string
    readonly knowledgeNote: string
    readonly waitingLabel: string
    readonly statusLabel: string
    readonly statusTone: "neutral" | "accent" | "success" | "warning"
    /** Where the row opens the agent. */
    readonly href: string
    /** The kind of agent in words ("Accounting"). */
    readonly roleName: string
    /** Red chips worded for what is not granted yet; empty when the agent has a connection. */
    readonly missingLabels: ReadonlyArray<string>
    /** Work it finished in the last 7 days; null while the dashboard has no answer. */
    readonly tasks7d: number | null
    /** Items waiting for the owner; null while the dashboard has no answer. */
    readonly waiting: number | null
    /** Another agent of this role may be added by the person. */
    readonly roleKey: string
    readonly canAddSame: boolean
    /** Pause a running agent, resume a paused one, nothing otherwise. */
    readonly liveAction: "pause" | "resume" | "none"
}

/** The kinds of agent that wear a mark. */
export type AgentKind =
    | "chatbot"
    | "lead_gen"
    | "sales"
    | "accounting"
    | "shifts"
    | "booking"
    | "inventory"
    | "loyalty"
    | "video"
    | "content"
    | "hiring"

/** One role card, already in the reader language. */
export interface RoleEntryView {
    readonly key: string
    readonly card: {
        readonly name: string
        readonly description: string
        readonly moduleKey: AgentKind
        readonly stateLabel: string
        readonly isInstalled: boolean
        readonly needsLabel: string
        readonly canInstall: boolean
        readonly installLabel: string
    }
}

/** One chip of a filter row: its key, words and how many entries it keeps. */
export interface FilterOptionView {
    readonly id: string
    readonly label: string
    readonly count: number
}

/** What the catalogue lists once the data arrived and the filters narrowed it. */
export interface AgentCatalogData {
    /** The installed agents the filters keep, the ones that wait for the owner first. */
    readonly rows: ReadonlyArray<AgentRowView>
    /** More agents than a person scans by eye: the chips and the search show. */
    readonly hasFilters: boolean
    readonly roles: ReadonlyArray<RoleEntryView>
}

/** Copy, state and commands of the agent catalogue. */
export interface AgentCatalogBaseProps {
    readonly props: {
        readonly yoursTitle: string
        readonly filterLabel: string
        /** The chips of the team, the first keeps every agent. */
        readonly filters: ReadonlyArray<FilterOptionView>
        readonly filter: string
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly searchClear: string
        readonly query: string
        /** The label of the first figure of a card (tasks in 7 days). */
        readonly openLabel: string
        readonly addLabel: string
        readonly pauseLabel: string
        readonly resumeLabel: string
        readonly removeLabel: string
        /** The agent whose removal waits for the confirmation, or null. */
        readonly removing: { readonly key: string; readonly name: string; readonly title: string } | null
        readonly removeBody: string
        readonly removeConfirm: string
        readonly removeCancel: string
        /** A pause, resume or removal is running. */
        readonly isBusy: boolean
        readonly tasksLabel: string
        /** The label of the second figure of a card (items waiting for the owner). */
        readonly waitingLabel: string
        /** The figure of a count the dashboard has no answer for. */
        readonly noCount: string
        readonly emptyTitle: string
        readonly emptyHint: string
        readonly emptyAction: string
        readonly noAgentsTitle: string
        readonly noAgentsHint: string
        readonly addTitle: string
        /** The anchor of the roles heading, the target of the header create action. */
        readonly addId: string
        readonly categoryLabel: string
        readonly categoryOptions: ReadonlyArray<FilterOptionView>
        readonly category: string
        readonly rolesEmptyTitle: string
        readonly rolesEmptyHint: string
        /** The agents and roles the filters keep. */
        readonly slot: DataSlot<AgentCatalogData>
        /** Fake entries of the same shape: the skeleton reuses the ready tree. */
        readonly placeholder: AgentCatalogData
        readonly slotLabels: SlotLabels
        readonly busyKey: string | null
    }
    readonly on: {
        readonly filter: (id: string) => void
        readonly query: (value: string) => void
        readonly clear: () => void
        readonly category: (value: string) => void
        readonly retry: () => void
        readonly install: (key: string) => void
        readonly open: (href: string) => void
        /** Opens the create dialog for one more agent of a role. */
        readonly add: (roleKey: string) => void
        readonly setLive: (installationId: string, live: boolean) => void
        readonly askRemove: (agent: { readonly key: string; readonly name: string } | null) => void
        readonly confirmRemove: (installationId: string) => void
    }
}
