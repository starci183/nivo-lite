import type { ProviderSpec } from "@modules/domain/mcp-gateway"
import type { ProviderAttachmentView } from "@modules/domain/mcp-tool-grants"
import type { AgentToolAccount, AgentToolLine, AgentToolOrigin, AgentToolText } from "./get-agent-tools.contracts"

/** The owner-facing words of a tool, as the blocks-core label file gives them. */
export interface ToolWords {
    /** `acts` or `reads`. */
    readonly kind: "acts" | "reads"
    /** Its name. */
    readonly title: AgentToolText
    /** One line. */
    readonly summary: AgentToolText
}

/** One grant row of the agent: a tool (or `connector.*`) and its mode. */
export interface ToolGrantRow {
    /** The full tool name or `connector.*`. */
    readonly tool: string
    /** `auto`, `ask` or `never`. */
    readonly mode: string
}

/** What the tool set of one agent is read from. */
export interface AgentToolsInput {
    /** The tools its module declares for its agent, in the declared order. */
    readonly declared: ReadonlyArray<string>
    /** The context reads every agent holds by default. */
    readonly defaultReads: ReadonlyArray<string>
    /** The agent's attachments to connected accounts, with the abilities ticked on each. */
    readonly attachments: ReadonlyArray<ProviderAttachmentView>
    /** The name of each account of the workspace, by connection. */
    readonly accountLabels: ReadonlyMap<string, string>
    /** The agent's grant rows. */
    readonly grants: ReadonlyArray<ToolGrantRow>
    /** The providers and the tools each ability holds. */
    readonly catalogue: ReadonlyArray<ProviderSpec>
    /** The owner-facing words of a tool, or null for one the label file does not name. */
    readonly wordsOf: (tool: string) => ToolWords | null
}

/** True for a tool some ability of a provider holds: the agent calls it only through an attached account. */
const isProviderTool = (catalogue: ReadonlyArray<ProviderSpec>, tool: string): boolean =>
    catalogue.some((spec) => spec.abilities.some((ability) => ability.tools.includes(tool)))

/** True for a provider tool whose account only the conversation tells (a send): NIVO's own website chat needs no account. */
const isChannelTool = (catalogue: ReadonlyArray<ProviderSpec>, tool: string): boolean =>
    catalogue.some((spec) => spec.abilities.some((ability) => ability.channels !== undefined && ability.tools.includes(tool)))

/** The attached accounts whose ticked ability holds the tool, in the order of the attachments. */
const accountsOf = (input: AgentToolsInput, tool: string): ReadonlyArray<AgentToolAccount> =>
    input.attachments.flatMap((row) => {
        const spec = input.catalogue.find((entry) => entry.provider === row.provider)
        return (spec?.abilities ?? []).flatMap((ability): ReadonlyArray<AgentToolAccount> => {
            const mode = row.abilities[ability.id]
            if (mode === undefined || !ability.tools.includes(tool)) return []
            return [
                {
                    connectionId: row.connectionId,
                    provider: row.provider,
                    accountLabel: input.accountLabels.get(row.connectionId) ?? row.provider,
                    ability: ability.id,
                    mode,
                },
            ]
        })
    })

/** The grant row that restricts the tool (its own row first, else its connector's `connector.*`), or null. */
const restrictionOf = (grants: ReadonlyArray<ToolGrantRow>, tool: string): "ask" | "never" | null => {
    const connector = `${tool.split(".", 1).join("")}.*`
    const row = grants.find((grant) => grant.tool === tool) ?? grants.find((grant) => grant.tool === connector)
    return row?.mode === "ask" || row?.mode === "never" ? row.mode : null
}

/** The tools ticked abilities give the agent beyond its declared set, in the order of the attachments. */
const abilityToolsOf = (input: AgentToolsInput): ReadonlyArray<string> =>
    input.attachments.flatMap((row) => {
        const spec = input.catalogue.find((entry) => entry.provider === row.provider)
        return (spec?.abilities ?? [])
            .filter((ability) => row.abilities[ability.id] !== undefined)
            .flatMap((ability) => ability.tools)
    })

/**
 * The tools one agent can call, in the shop's words: its module's declared set first (in the declared order), then the provider
 * tools its ticked abilities add, then the default context reads, each tool once. A provider tool carries the attached accounts that
 * hold it and is ready only when one does (a send is ready without one: the website chat needs no account); a grant row of `never` makes any tool not ready, `ask` is shown as it is. A tool the label
 * file does not name is shown by its id as an action. Pure.
 */
export const agentToolsOf = (input: AgentToolsInput): ReadonlyArray<AgentToolLine> => {
    const origins = new Map<string, AgentToolOrigin>()
    const add = (tools: ReadonlyArray<string>, origin: AgentToolOrigin): void => {
        for (const tool of tools) if (!origins.has(tool)) origins.set(tool, origin)
    }
    add(input.declared, "declared")
    add(abilityToolsOf(input), "ability")
    add(input.defaultReads, "default-read")
    return [...origins].map(([id, origin]): AgentToolLine => {
        const words = input.wordsOf(id)
        const provider = isProviderTool(input.catalogue, id)
        const accounts = provider ? accountsOf(input, id) : []
        const grant = restrictionOf(input.grants, id)
        return {
            id,
            title: words?.title ?? { vi: id, en: id },
            summary: words?.summary ?? { vi: "", en: "" },
            kind: words?.kind ?? "acts",
            origin,
            grant,
            accounts,
            ready: grant !== "never" && (!provider || accounts.length > 0 || isChannelTool(input.catalogue, id)),
        }
    })
}
