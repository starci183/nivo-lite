import type { useTranslations } from "next-intl"
import { PROVIDERS, PROVIDER_LOGO, isProvider } from "@/hooks/connection-providers"
import type { InstalledAgent } from "@/hooks/installations"
import type { AgentCatalogEntry, AgentCatalogRow, CatalogGrantChip } from "@/modules/agentCatalog"
import { MODULE_REGISTRY } from "@/modules/catalog"
import { agentLifecycleTone, foldText } from "@/modules/installations"

/** The translator of the catalogue copy. */
export type CatalogCopy = ReturnType<typeof useTranslations<"agentCatalog">>

/** One grant of a catalog entry. */
type Grant = AgentCatalogEntry["grants"][number]

/** The words an account is known by: the bot username, the bank account with its masked number, or the connection name. */
const accountLabelOf = (grant: Grant): string => {
    if (grant.botUsername !== null && grant.botUsername !== "") return `@${grant.botUsername}`
    if (grant.accountMasked !== null && !grant.name.includes(grant.accountMasked))
        return `${grant.name} ${grant.accountMasked}`
    return grant.name
}

/** One bound connection: its provider mark and the account. */
const grantChipOf = (grant: Grant, index: number): CatalogGrantChip => ({
    id: `${grant.connectionId}-${grant.purpose}-${String(index)}`,
    logo: isProvider(grant.provider) ? (PROVIDER_LOGO[grant.provider] ?? null) : null,
    label: accountLabelOf(grant),
    brand: isProvider(grant.provider) ? PROVIDERS[grant.provider].brand : grant.name,
})

/** What the dashboard counts for one agent over the last 7 days. */
export interface AgentCounts {
    readonly tasks: number
    readonly waiting: number
}

/** The most agents a team shows without the chips and the search. */
export const TEAM_FILTER_FROM = 6

/** What the menu offers for a lifecycle: pause a running agent, resume a paused one. */
const liveActionOf = (lifecycle: InstalledAgent["lifecycle"]): AgentCatalogRow["liveAction"] => {
    if (lifecycle === "running") return "pause"
    return lifecycle === "paused" ? "resume" : "none"
}

/** One installed agent as a card of the team, in the reader language. */
export const catalogRowOf = (
    agent: InstalledAgent,
    t: CatalogCopy,
    counts: AgentCounts | undefined,
    canAdd: boolean,
): AgentCatalogRow => {
    const grants = (agent.catalog?.grants ?? []).map((grant, index) => grantChipOf(grant, index))
    /** A connection the agent has whose provider is not connected (an error, pending or disconnected): it cannot act through it. */
    const missingLabels = [...new Set((agent.catalog?.grants ?? []).filter((grant) => grant.status !== "connected").map((grant) => grantChipOf(grant, 0).brand))].map((brand) => t("cardMissing", { brand }))
    const needsConnection = MODULE_REGISTRY[agent.moduleKey].connectionProviders.length > 0
    const subtitle = agent.handle === "" ? agent.roleName : `@${agent.handle}`
    return {
        key: agent.id,
        name: agent.name,
        roleKey: agent.moduleKey,
        picture: agent.avatarUrl,
        isInitials: agent.avatarUrl === null && agent.avatarPreset === "initials",
        seed: agent.seed,
        subtitle,
        grants,
        menuLabel: t("cardMenu", { name: agent.name }),
        statusLabel: t(`status_${agent.lifecycle}`),
        statusTone: agentLifecycleTone(agent.lifecycle),
        href: agent.href,
        isMissingConnection: agent.lifecycle === "needs_connection" || (needsConnection && grants.length === 0),
        hasWaitingFacts: (agent.catalog?.knowledge.factsWaiting ?? 0) > 0,
        searchText: foldText(`${agent.name} ${subtitle} ${agent.roleName}`),
        roleName: agent.roleName,
        missingLabels,
        tasks7d: counts?.tasks ?? null,
        waiting: counts?.waiting ?? null,
        canAddSame: canAdd && MODULE_REGISTRY[agent.moduleKey].multiInstance,
        liveAction: liveActionOf(agent.lifecycle),
    }
}

/** The providers a role works through, by the brand names a person knows them by; empty when it needs none. */
export const needsLabelOf = (providers: ReadonlyArray<string>, t: CatalogCopy): string =>
    providers.length === 0
        ? ""
        : t("roleNeeds", { providers: providers.map((id) => (isProvider(id) ? PROVIDERS[id].brand : id)).join(", ") })
