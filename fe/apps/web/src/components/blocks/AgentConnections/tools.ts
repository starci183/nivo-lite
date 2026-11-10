import type { RightsTranslate } from "@/components/composites/ProviderRightsCard"
import {
    AGENT_TOOL_ORIGINS,
    grantModeOf,
    isGrantMode,
    type AgentToolGrantMode,
    type AgentToolWire,
} from "@/hooks/agentTools"
import { accountTitleOf, pickLabel, providerLabelOf, type HeldAccount } from "@/hooks/providerRights"
import type { NivoToolsView, ToolGrantView, ToolGroupView, ToolRowView } from "./types"

/** What the tools section needs from the page besides the tools. */
export interface ToolsScope {
    readonly locale: string
    readonly agentName: string
    readonly linkHref: string
    /** Every account of the shop's board (attached or attachable), to name an account and an ability in the shop's words. */
    readonly accounts: ReadonlyArray<HeldAccount>
    readonly isSaving: boolean
    readonly setGrant: (tool: string, mode: AgentToolGrantMode) => void
}

/** The name of a tool in the reader language; the tool id while the back end sends no label. */
const titleOf = (tool: AgentToolWire, locale: string): string => {
    const title = pickLabel(tool.title, locale).trim()
    return title === "" ? tool.id : title
}

/** "<provider> · <account> · <mode>" for each attached account a provider tool goes through. */
const accountsLineOf = (t: RightsTranslate, tool: AgentToolWire, scope: ToolsScope): string =>
    tool.accounts
        .map((entry) => {
            const held = scope.accounts.find((one) => one.account.connectionId === entry.connectionId)
            const provider = providerLabelOf(held?.provider, entry.provider, scope.locale)
            const mode = entry.mode === "ask" ? t("modeAsk") : t("modeAuto")
            return `${accountTitleOf(provider, entry.accountLabel)} · ${mode}`
        })
        .join(", ")

/** The ability of the shop's providers that holds a tool, in the reader language. */
const abilityOf = (tool: AgentToolWire, scope: ToolsScope): string | undefined => {
    const ability = scope.accounts
        .flatMap((one) => one.provider.abilities)
        .find((entry) => entry.tools.includes(tool.id))
    return ability === undefined ? undefined : pickLabel(ability.label, scope.locale)
}

/** Why the agent cannot call a tool now, from the data: the owner blocked it, or no attached account ticks the ability that holds it. */
const reasonOf = (t: RightsTranslate, tool: AgentToolWire, scope: ToolsScope): string => {
    if (tool.grant === "never") return t("toolBlocked")
    if (tool.origin === "ability" && tool.accounts.length === 0) {
        const ability = abilityOf(tool, scope)
        return ability === undefined ? t("toolNoAccount") : t("toolNoAbility", { ability })
    }
    return t("toolUnready")
}

/** The 12 line under a tool: why it is not usable, else the accounts a provider tool goes through, else what it does. */
const subtitleOf = (t: RightsTranslate, tool: AgentToolWire, scope: ToolsScope): string => {
    if (!tool.ready) return reasonOf(t, tool, scope)
    if (tool.origin === "ability" && tool.accounts.length > 0) return accountsLineOf(t, tool, scope)
    return pickLabel(tool.summary, scope.locale).trim()
}

/** The grant control of one of the agent's own "acts" tools (none for a read, a provider tool or a context read). */
const grantOf = (t: RightsTranslate, tool: AgentToolWire, title: string, scope: ToolsScope): ToolGrantView | undefined =>
    tool.origin === "declared" && tool.kind === "acts"
        ? {
              label: t("modeLabel", { capability: title }),
              value: grantModeOf(tool.grant),
              options: [
                  { id: "auto", label: t("modeAuto") },
                  { id: "ask", label: t("modeAsk") },
                  { id: "never", label: t("modeNever") },
              ],
              isDisabled: scope.isSaving,
              onChange: (value) => {
                  if (isGrantMode(value) && value !== grantModeOf(tool.grant)) scope.setGrant(tool.id, value)
              },
          }
        : undefined

/** One tool as a row. */
const rowOf = (t: RightsTranslate, tool: AgentToolWire, scope: ToolsScope): ToolRowView => {
    const title = titleOf(tool, scope.locale)
    return {
        id: tool.id,
        title,
        subtitle: subtitleOf(t, tool, scope),
        chip: tool.kind === "acts" ? t("toolActs") : t("toolReads"),
        isReady: tool.ready,
        grant: grantOf(t, tool, title, scope),
    }
}

/** The label of an origin group. */
const groupLabelOf = (t: RightsTranslate, origin: string, agentName: string): string => {
    if (origin === "declared") return t("toolsDeclared", { agent: agentName })
    if (origin === "ability") return t("toolsAbility")
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
