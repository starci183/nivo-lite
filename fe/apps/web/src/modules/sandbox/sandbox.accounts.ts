import type { SandboxAccountsQuery } from "@/modules/api"
import type { SandboxAccountsData, SandboxAgentChoice } from "@/modules/types"
import type { SandboxWords } from "./sandbox.words"

/** One sandbox account as the back end answers it. */
type SandboxAccountWire = SandboxAccountsQuery["sandboxAccounts"][number]

/** The account the right column shows: the one the person chose while it still exists, else the first; none while nothing was read. */
export const selectedAccountOf = (
    accounts: ReadonlyArray<SandboxAccountWire> | undefined,
    chosenId: string | null,
): SandboxAccountWire | undefined => accounts?.find((account) => account.id === chosenId) ?? accounts?.[0]

/** The accounts under their provider's name, providers in the order of their names, each account with its provider's mark. */
export const accountsDataOf = (
    accounts: ReadonlyArray<SandboxAccountWire>,
    selectedId: string,
    words: SandboxWords,
    locale: string,
): SandboxAccountsData => {
    const byProvider = new Map<string, Array<SandboxAccountWire>>()
    for (const account of accounts) {
        byProvider.set(account.provider, [...(byProvider.get(account.provider) ?? []), account])
    }
    const groups = [...byProvider.entries()]
        .map(([provider, rows]) => ({
            provider,
            label: words.providerName(provider),
            rows: rows.map((row) => ({
                id: row.id,
                name: row.name,
                logo: words.providerLogo(provider),
                agentsLine: words.agentsLine(row.agents.map((agent) => agent.label)),
            })),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, locale))
    return { groups, count: accounts.length, selectedId }
}

/** The providers a sandbox account can be opened for, by their names. */
export const providerChoicesOf = (
    providers: ReadonlyArray<string>,
    words: SandboxWords,
    locale: string,
): ReadonlyArray<{ readonly id: string; readonly label: string }> =>
    providers
        .map((id) => ({ id, label: words.providerName(id) }))
        .sort((left, right) => left.label.localeCompare(right.label, locale))

/** An agent the owner may choose, by its name. */
interface AgentWire {
    readonly id: string
    readonly name: string
}

/** The agents of the workspace as a choice list, in the order of their names; the ones in `except` are left out. */
export const sandboxAgentChoicesOf = (
    agents: ReadonlyArray<AgentWire>,
    except: ReadonlyArray<string>,
    locale: string,
): ReadonlyArray<SandboxAgentChoice> =>
    agents
        .filter((agent) => !except.includes(agent.id))
        .map((agent) => ({ id: agent.id, label: agent.name }))
        .sort((left, right) => left.label.localeCompare(right.label, locale))
