import type { ProviderSpec } from "@modules/domain/tools"
import type { ProviderAttachmentView } from "@modules/domain/tool-grants"
import type { AgentToolAccount, AgentToolLine, AgentToolOrigin, AgentToolText } from "./agent-tool-lines.contracts"

/** The owner-facing words of a tool, as the blocks-core label file gives them. */
export interface ToolWords {
    /** `acts` or `reads`. */
    readonly kind: "acts" | "reads"
    /** Its name. */
    readonly title: AgentToolText
    /** One line. */
    readonly summary: AgentToolText
}

/** One grant row of the agent: a tool (or a wildcard `<prefix>.*`) and its mode. */
export interface ToolGrantRow {
    /** The full tool name or a wildcard `<prefix>.*`. */
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
    /** The agent's attachments to connected accounts (agent + connection + provider). */
    readonly attachments: ReadonlyArray<ProviderAttachmentView>
    /** The name of each account of the workspace, by connection. */
    readonly accountLabels: ReadonlyMap<string, string>
    /** The agent's grant rows. */
    readonly grants: ReadonlyArray<ToolGrantRow>
    /** The providers and the tools each serves. */
    readonly catalogue: ReadonlyArray<ProviderSpec>
    /** The owner-facing words of a tool, or null for one the label file does not name. */
    readonly wordsOf: (tool: string) => ToolWords | null
}

/** True for a tool some provider serves: the agent calls it only through an attached account. */
const isProviderTool = (catalogue: ReadonlyArray<ProviderSpec>, tool: string): boolean =>
    catalogue.some((spec) => spec.abilities.some((ability) => ability.tools.includes(tool)))

/** True when the provider's catalogue entry serves the tool (information: it picks an account, it grants nothing). */
const servesTool = (catalogue: ReadonlyArray<ProviderSpec>, provider: string, tool: string): boolean =>
    catalogue.some((spec) => spec.provider === provider && spec.abilities.some((group) => group.tools.includes(tool)))

/** True for a provider tool whose account only the conversation tells (a send): NIVO's own website chat needs no account. */
const isChannelTool = (catalogue: ReadonlyArray<ProviderSpec>, tool: string): boolean =>
    catalogue.some((spec) => spec.abilities.some((ability) => ability.channels !== undefined && ability.tools.includes(tool)))

/** The attached accounts of a provider that serves the tool, in the order of the attachments. */
const accountsOf = (input: AgentToolsInput, tool: string): ReadonlyArray<AgentToolAccount> =>
    input.attachments
        .filter((row) => servesTool(input.catalogue, row.provider, tool))
        .map((row) => ({
            connectionId: row.connectionId,
            provider: row.provider,
            accountLabel: input.accountLabels.get(row.connectionId) ?? row.provider,
        }))

/** The prefix a wildcard row covers (`nivo.brain.*` → `nivo.brain`), or null for an exact row or a bare `nivo.*` (it covers nothing). */
const wildcardPrefixOf = (tool: string): string | null =>
    tool.endsWith(".*") && tool !== "nivo.*" && tool.length > 2 ? tool.slice(0, -2) : null

/**
 * The grant row that restricts the tool, as the gateway reads it: its own row first, else the wildcard row with the LONGEST prefix
 * that covers it (`nivo.brain.*`), or null.
 */
const restrictionOf = (grants: ReadonlyArray<ToolGrantRow>, tool: string): "ask" | null => {
    const covering = grants
        .map((grant) => ({ grant, prefix: wildcardPrefixOf(grant.tool) }))
        .filter((entry) => entry.prefix !== null && tool.startsWith(`${entry.prefix}.`))
        .toSorted((a, b) => (b.prefix?.length ?? 0) - (a.prefix?.length ?? 0))
    const row = grants.find((grant) => grant.tool === tool) ?? covering[0]?.grant
    // `never` is REMOVED (nivo-frame `rights`): no row carries it; a row is only the allow-list of a road outside every node.
    return row?.mode === "ask" ? "ask" : null
}

/** The tools the attached accounts' providers serve beyond the declared set, in the order of the attachments. */
const attachedToolsOf = (input: AgentToolsInput): ReadonlyArray<string> =>
    input.attachments.flatMap((row) => {
        const spec = input.catalogue.find((entry) => entry.provider === row.provider)
        return (spec?.abilities ?? []).flatMap((group) => group.tools)
    })

/**
 * The tools one agent can call, in the shop's words: its module's declared set first (in the declared order), then the provider
 * tools its attached accounts serve, then the default context reads, each tool once. A provider tool carries the attached accounts that
 * serve it and is ready only when one does (a send is ready without one: the website chat needs no account); a grant row of `ask` is shown as it is. A tool the label
 * file does not name is shown by its id as an action. Pure.
 */
export const agentToolsOf = (input: AgentToolsInput): ReadonlyArray<AgentToolLine> => {
    const origins = new Map<string, AgentToolOrigin>()
    const add = (tools: ReadonlyArray<string>, origin: AgentToolOrigin): void => {
        for (const tool of tools) if (!origins.has(tool)) origins.set(tool, origin)
    }
    add(input.declared, "declared")
    add(attachedToolsOf(input), "attached")
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
            ready: !provider || accounts.length > 0 || isChannelTool(input.catalogue, id),
        }
    })
}
