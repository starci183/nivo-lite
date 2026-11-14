import type { AgentCatalogQuery } from "@/modules/api"
import type { ModuleKey } from "@/modules/catalog"
import { foldText } from "@/modules/installations"

/** What one agent holds and reads, as the back end `agentCatalog` read answers it. */
export type AgentCatalogEntry = AgentCatalogQuery["agentCatalog"][number]

/** One connection granted to an agent, already in the reader language. */
export interface CatalogGrantChip {
    readonly id: string
    /** The provider mark, or null when the provider has none. */
    readonly logo: string | null
    /** The provider as people know it ("SePay", "Telegram", "Zalo OA"). */
    readonly brand: string
    /** The account: bot username, bank account or connection name. */
    readonly label: string
}

/** What one installed agent shows as a row of the list, already in the reader language. */
export interface AgentCatalogRow {
    readonly key: string
    readonly name: string
    /** The role the agent belongs to: the group it is listed under. */
    readonly roleKey: ModuleKey
    /** The agent's own picture (an upload or a preset image); null draws the default sprout, or the initials. */
    readonly picture: string | null
    /** The owner chose the initials preset. */
    readonly isInitials: boolean
    /** The seed of its generated colour: the agent id. */
    readonly seed: string
    /** "@handle - role". */
    readonly subtitle: string
    readonly grants: ReadonlyArray<CatalogGrantChip>
    /** Names the menu of the granted connections. */
    readonly menuLabel: string
    readonly statusLabel: string
    readonly statusTone: "neutral" | "accent" | "success" | "warning"
    /** Where the row opens the agent. */
    readonly href: string
    /** The agent has no usable connection: the "Missing connection" filter keeps it. */
    readonly isMissingConnection: boolean
    /** Facts of the agent wait for the owner: the "Facts waiting" filter keeps it. */
    readonly hasWaitingFacts: boolean
    /** Name, handle and role folded for the search. */
    readonly searchText: string
    /** The kind of agent in words ("Accounting"). */
    readonly roleName: string
    /** Red chips for what is not granted yet while the agent has no connection at all ("SePay has no access yet"); empty otherwise. */
    readonly missingLabels: ReadonlyArray<string>
    /** Work it finished in the last 7 days; null while the dashboard has no answer for it. */
    readonly tasks7d: number | null
    /** Items waiting for the owner; null while the dashboard has no answer for it. */
    readonly waiting: number | null
    /** Another agent of this role may be added by the person (a manager, a role that runs several). */
    readonly canAddSame: boolean
    /** What the menu offers for its running state: pause a running agent, resume a paused one, nothing otherwise. */
    readonly liveAction: "pause" | "resume" | "none"
}

/** The agents that wait for the owner first (the most waiting first), the rest in their order. */
export const waitingFirst = (rows: ReadonlyArray<AgentCatalogRow>): ReadonlyArray<AgentCatalogRow> =>
    [...rows].sort((a, b) => (b.waiting ?? 0) - (a.waiting ?? 0))

/** The chip of the agents table that keeps every agent. */
export const FILTER_ALL = "all"

/** The chip that keeps the agents without a usable connection. */
export const FILTER_MISSING = "missing"

/** The chip that keeps the agents with facts waiting for the owner. */
export const FILTER_WAITING = "waiting"

/** The rows the chip and the search keep. */
export const filterRows = (
    rows: ReadonlyArray<AgentCatalogRow>,
    filter: string,
    query: string,
): ReadonlyArray<AgentCatalogRow> => {
    const tokens = foldText(query)
        .split(/\s+/u)
        .filter((token) => token !== "")
    return rows.filter(
        (row) =>
            (filter !== FILTER_MISSING || row.isMissingConnection) &&
            (filter !== FILTER_WAITING || row.hasWaitingFacts) &&
            tokens.every((token) => row.searchText.includes(token)),
    )
}

/** What one role card shows, already in the reader language. */
interface CatalogRoleCard {
    readonly name: string
    readonly description: string
    /** The kind of agent: its mark and its colour. */
    readonly moduleKey: ModuleKey
    /** "Installed 1" or "Not installed". */
    readonly stateLabel: string
    readonly isInstalled: boolean
    /** "Needs: Telegram, Zalo OA"; empty when the role needs no connection. */
    readonly needsLabel: string
    /** The person may set an agent up. */
    readonly canInstall: boolean
    readonly installLabel: string
}

/** One role card with the key the install handler names it by. */
export interface AgentCatalogRoleEntry {
    readonly key: string
    readonly card: CatalogRoleCard
}

/** One chip of a filter row: its key, words and how many entries it keeps. */
export interface CatalogFilterOption {
    readonly id: string
    readonly label: string
    readonly count: number
}
