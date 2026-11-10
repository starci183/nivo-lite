import { CATALOG, catalogKey } from "@/hooks/connection-catalog"
import type { CatalogEntry } from "@/hooks/connection-catalog"
import { isProvider, providerKey } from "@/hooks/connection-providers"
import { connectionFactsOf } from "@/hooks/connection-rows"
import { liveConnections, sortRows, wizardQuery } from "@/hooks/connections"
import { listRowOf } from "@/hooks/connectionsPanes"
import { groupOfConnector, providerSegmentOf, providersOfSegment, unitOfProvider } from "@/modules/connection-groups"
import { lifecycleOf, PHASE_COUNT, phaseOfLife } from "@/modules/connection-lifecycle"
import type {
    Connection,
    ConnectionAgentUse,
    ConnectionProviderAbout,
    ConnectionProviderRow,
    ConnectionProviderFigure,
    Provider,
} from "@/modules/types"

/** A catalog reader of the `connections` namespace: a key and the values of its placeholders. */
export type ProviderTranslate = (key: string, values?: Record<string, string | number>) => string

/** The providers a page address names (Google's account page names two); empty when the segment is no provider. */
export const providersOfPage = (segment: string): ReadonlyArray<Provider> =>
    providersOfSegment(segment).filter((id): id is Provider => isProvider(id))

/** The address of a provider's own page under the hub: `<hub>/<segment>`. */
export const providerPageHref = (hubHref: string, provider: Provider): string =>
    `${hubHref}/${providerSegmentOf(provider)}`

/** The hub address that opens the add wizard of a provider (the same query the library's connect command makes). */
export const providerAddHref = (hubHref: string, provider: Provider): string => `${hubHref}?${wizardQuery(provider)}`

/** The library entry of a provider, when the catalog has one: the source of its blurb and what it brings. */
export const entryOfProvider = (provider: Provider): CatalogEntry | undefined =>
    CATALOG.find((entry) => entry.provider === provider)

/** The group heading a provider sits under in the library ("Chat channels"). */
export const groupLabelOf = (provider: Provider, t: ProviderTranslate): string => {
    const entry = entryOfProvider(provider)
    return entry === undefined ? "" : t(`group_${groupOfConnector(entry.id, entry.category)}`)
}

/** The setup step a row names while the connection is set up or waits for its first event; empty otherwise. */
const stepOf = (connection: Connection, t: ProviderTranslate): string => {
    const life = lifecycleOf(connection)
    return life.id === "setup" || life.id === "waiting"
        ? t("rowStep", { n: phaseOfLife(life), total: PHASE_COUNT })
        : ""
}

/** One grant as the wire answers it: the agent, what it uses the connection for and its level. */
export interface ConnectionAgentGrantWire {
    readonly connectionId: string
    readonly agentId: string
    readonly agentName: string
    readonly module: string
    readonly purpose: string
    readonly access: string
}

/** A reader of the `agentConnections` namespace, the words of the agent's own Connections tab. */
export type GrantTranslate = (key: string) => string

const PURPOSE_KEYS: Readonly<Record<string, string>> = {
    inbound_chat: "purposeInboundChat",
    outbound_chat: "purposeOutboundChat",
    bank_feed: "purposeBankFeed",
    data_source: "purposeDataSource",
    tool: "purposeTool",
    lead_source: "purposeLeadSource",
}

const LEVEL_KEYS: Readonly<Record<string, string>> = { read: "levelRead", ask: "levelAsk", auto: "levelAuto" }

const LEVEL_TONES: Readonly<Record<string, ConnectionAgentUse["tone"]>> = {
    read: "neutral",
    ask: "accent",
    auto: "warning",
}

/** The agents that use one connection, one entry per grant, in the words of the agent's Connections tab. */
export const agentUsesOf = (
    grants: ReadonlyArray<ConnectionAgentGrantWire>,
    connectionId: string,
    t: GrantTranslate,
): ReadonlyArray<ConnectionAgentUse> =>
    grants
        .filter((grant) => grant.connectionId === connectionId)
        .map((grant) => ({
            id: `${grant.agentId}:${grant.purpose}`,
            name: grant.agentName,
            module: grant.module,
            purpose: t(PURPOSE_KEYS[grant.purpose] ?? "purposeTool"),
            level: t(LEVEL_KEYS[grant.access] ?? "levelRead"),
            tone: LEVEL_TONES[grant.access] ?? "neutral",
        }))

/** One row of a provider's list: the shared row, its description narrowed to what identifies the connection and its step, and its agents. */
export const providerRowOf = (
    connection: Connection,
    t: ProviderTranslate,
    bankName: (code: string) => string,
    workspaceId: string,
    uses: ReadonlyArray<ConnectionAgentUse>,
): ConnectionProviderRow => {
    const row = listRowOf(connection, t, bankName, workspaceId, {})
    const description = [connectionFactsOf(connection, t, bankName), stepOf(connection, t)]
        .filter((part) => part !== "")
        .join(" · ")
    return { ...row, description, uses }
}

/** The connections of a page, sorted: what needs the owner first. Disconnected ones have no page and are left out. */
export const connectionsOfPage = (
    items: ReadonlyArray<Connection>,
    providers: ReadonlyArray<Provider>,
): ReadonlyArray<Connection> =>
    sortRows(liveConnections(items).filter((connection) => providers.includes(connection.provider)))

/** The line under the title: the group, and how many connections the provider holds once they are read. */
export const metaOf = (provider: Provider, count: number | undefined, t: ProviderTranslate): string =>
    [groupLabelOf(provider, t), count === undefined ? "" : t(`unit_${unitOfProvider(provider)}`, { count })]
        .filter((part) => part !== "")
        .join(" · ")

/** The three key figures: what runs out of how many, the last event, and the agents that use the provider. */
export const figuresOf = (
    connections: ReadonlyArray<Connection>,
    provider: Provider,
    agentNames: Readonly<Record<string, string>>,
    lastEvent: string,
    t: ProviderTranslate,
): ReadonlyArray<ConnectionProviderFigure> => {
    const running = connections.filter((connection) => lifecycleOf(connection).id === "running").length
    const agents = [...new Set(connections.flatMap((connection) => connection.agentIds))]
    const names = agents.map((id) => agentNames[id]).filter((name): name is string => name !== undefined)
    return [
        {
            id: "running",
            term: t("providerFigureRunning"),
            value: running,
            meta: t("providerFigureRunningMeta", {
                count: t(`unit_${unitOfProvider(provider)}`, { count: connections.length }),
            }),
        },
        {
            id: "last",
            term: t("providerFigureLast"),
            value: lastEvent === "" ? t("providerFigureLastNone") : lastEvent,
        },
        {
            id: "agents",
            term: t("providerFigureAgents"),
            value: agents.length,
            ...(names.length === 0 ? {} : { meta: names.join(", ") }),
        },
    ]
}

/** The "About the provider" lines from the library's own words: the blurb, what it brings, what to have ready, who it is for. */
export const aboutOf = (provider: Provider, t: ProviderTranslate): ReadonlyArray<ConnectionProviderAbout> => {
    const entry = entryOfProvider(provider)
    if (entry === undefined) return []
    const names = entry.audience.includes("any")
        ? t("aud_any")
        : entry.audience.map((audience) => t(`aud_${audience}`)).join(", ")
    return [
        { id: "blurb", term: t(providerKey(provider, "title")), description: t(catalogKey(entry, "blurb")) },
        { id: "brings", term: t("detailBrings"), description: t(catalogKey(entry, "brings")) },
        { id: "needs", term: t("detailNeeds"), description: t(catalogKey(entry, "needs")) },
        { id: "for", term: t("detailFor"), description: names },
    ]
}

/** The latest event time among connections, as an ISO date; empty when none has come. */
export const latestEventOf = (connections: ReadonlyArray<Connection>): string =>
    connections.reduce((latest, connection) => {
        const at = connection.lastEventAt ?? ""
        return at > latest ? at : latest
    }, "")
