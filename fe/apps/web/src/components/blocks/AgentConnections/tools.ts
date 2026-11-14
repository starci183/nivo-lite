import type { RightsTranslate } from "@/components/composites/ProviderRightsCard"
import { AGENT_TOOL_ORIGINS, type AgentToolWire } from "@/hooks/agentTools"
import { accountTitleOf, pickLabel, providerLabelOf, type HeldAccount } from "@/hooks/providerRights"
import type { NivoToolsView, ToolGroupView, ToolRowView } from "./types"

/** What the tools section needs from the page besides the tools. */
export interface ToolsScope {
    readonly locale: string
    readonly agentName: string
    readonly linkHref: string
    /** Every account of the shop's board (attached or attachable), to name an account in the shop's words. */
    readonly accounts: ReadonlyArray<HeldAccount>
}

/** The name of a tool in the reader language; the tool id while the back end sends no label. */
const titleOf = (tool: AgentToolWire, locale: string): string => {
    const title = pickLabel(tool.title, locale).trim()
    return title === "" ? tool.id : title
}

/** "<provider> · <account>" for each attached account a provider tool goes through (the mode is the step's, not the account's). */
const accountsLineOf = (tool: AgentToolWire, scope: ToolsScope): string =>
    tool.accounts
        .map((entry) => {
            const held = scope.accounts.find((one) => one.account.connectionId === entry.connectionId)
            const provider = providerLabelOf(held?.provider, entry.provider, scope.locale)
            return accountTitleOf(provider, entry.accountLabel)
        })
        .join(", ")

/** Why the agent cannot call a tool now, from the data: no attached account serves it (detach is the kill switch; no account, no tool). */
const reasonOf = (t: RightsTranslate, tool: AgentToolWire): string => {
    if (tool.origin === "attached" && tool.accounts.length === 0) return t("toolNoAccount")
    return t("toolUnready")
}

/** The 12 line under a tool: why it is not usable, else the accounts a provider tool goes through, else what it does. */
const subtitleOf = (t: RightsTranslate, tool: AgentToolWire, scope: ToolsScope): string => {
    if (!tool.ready) return reasonOf(t, tool)
    if (tool.origin === "attached" && tool.accounts.length > 0) return accountsLineOf(tool, scope)
    return pickLabel(tool.summary, scope.locale).trim()
}

/** One tool as a row. */
const rowOf = (t: RightsTranslate, tool: AgentToolWire, scope: ToolsScope): ToolRowView => {
    const title = titleOf(tool, scope.locale)
    return {
        id: tool.id,
        title,
        subtitle: subtitleOf(t, tool, scope),
        chip: tool.kind === "acts" ? t("toolActs") : t("toolReads"),
        isReady: tool.ready,
    }
}

/** The label of an origin group. */
const groupLabelOf = (t: RightsTranslate, origin: string, agentName: string): string => {
    if (origin === "declared") return t("toolsDeclared", { agent: agentName })
    if (origin === "attached") return t("toolsAbility")
    return t("toolsDefault")
}

/** The NIVO tools section, in the order the back end sends them inside three origin groups; undefined (left out) while there is none. */
export const toolsOf = (
    t: RightsTranslate,
    tools: ReadonlyArray<AgentToolWire> | undefined,
    scope: ToolsScope,
): NivoToolsView | undefined => {
    if (tools === undefined || tools.length === 0) return undefined
    const groups = AGENT_TOOL_ORIGINS.flatMap((origin): ReadonlyArray<ToolGroupView> => {
        const rows = tools.filter((tool) => tool.origin === origin).map((tool) => rowOf(t, tool, scope))
        return rows.length === 0 ? [] : [{ id: origin, label: groupLabelOf(t, origin, scope.agentName), rows }]
    })
    return {
        title: t("toolsTitle"),
        count: groups.reduce((sum, group) => sum + group.rows.length, 0),
        linkLabel: t("toolsLink"),
        linkHref: scope.linkHref,
        groups,
        emptyLabel: t("toolsEmpty"),
    }
}
