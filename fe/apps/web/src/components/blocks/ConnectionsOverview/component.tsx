import { Region, SectionHeader, SurfaceListCard } from "@starci/grammar/common"
import type { ComponentType } from "react"
import type { AgentOption, Connection, Provider } from "@/modules/types"
import { connectionsPageClassNames as classNames } from "./classNames"

/** One connection of a provider list with the names of the agents bound to it. */
export interface PageRow {
    readonly connection: Connection
    readonly agentNames: ReadonlyArray<string>
}

/** One provider's list card. */
export interface PageCard {
    readonly provider: Provider
    readonly title: string
    readonly fact: string
    readonly rows: ReadonlyArray<PageRow>
}

/** One group of providers on the page. */
export interface PageGroup {
    readonly id: string
    readonly title: string
    readonly count: number
    readonly cards: ReadonlyArray<PageCard>
}

/** The words of the page, resolved by the connected feature host. */
export interface PageWords {
    readonly title: string
    readonly description: string
    readonly crumbLabel: string
    readonly crumbHome: string
    readonly homeHref: string
    readonly summary: string
    readonly ownerOnly: string
    readonly emptyTitle: string
    readonly emptyHint: string
    readonly automationsLink: string
    readonly automationsHref: string
    readonly loadFailed: string
    readonly forbiddenTitle: string
    readonly forbiddenBody: string
    readonly forbiddenBack: string
    readonly forbiddenHref: string
}

/** What the overview draws: its words, the signed-in viewer and what the feature host loaded. */
export interface ConnectionsOverviewProps {
    readonly props: {
        /** `loading`: the data is on its way; `ready`: the board; `forbidden`: staff see a friendly 403; `failed`: the data did not load. */
        readonly mode: "loading" | "ready" | "forbidden" | "failed"
        readonly words: PageWords
        readonly view: "connected" | "library"
        readonly ownerEmail: string
        readonly canManage: boolean
        readonly localOnly: boolean
        readonly items: ReadonlyArray<Connection>
        readonly agents: ReadonlyArray<AgentOption>
        readonly agentNames: Readonly<Record<string, string>>
        readonly liveCount: number
        readonly attention: { readonly first: Connection; readonly count: number } | null
        readonly groups: ReadonlyArray<PageGroup>
    }
    readonly renderAddButton: ComponentType<{ readonly provider: Provider; readonly kind: "add" | "connect" }>
    readonly renderAttention: ComponentType<{
        readonly connection: Connection
        readonly count: number
        readonly canManage: boolean
    }>
    readonly renderLibrary: ComponentType<{ readonly items: ReadonlyArray<Connection> }>
    readonly renderRow: ComponentType<{
        readonly connection: Connection
        readonly agentNames: ReadonlyArray<string>
        readonly localOnly: boolean
        readonly ownerEmail: string
        readonly agents: ReadonlyArray<AgentOption>
        readonly canManage: boolean
    }>
    readonly renderViewTabs: ComponentType<{ readonly selected: "connected" | "library"; readonly liveCount: number }>
}

/** The provider lists receive the client blocks registered by the feature host. */
interface ConnectionsListsProps {
    readonly props: ConnectionsOverviewProps["props"]
    readonly renderAddButton: ConnectionsOverviewProps["renderAddButton"]
    readonly renderRow: ConnectionsOverviewProps["renderRow"]
}

/** Provider cards and their connection rows, using the blocks supplied by the feature host. */
export const ConnectionsLists = (props: ConnectionsListsProps) =>
    props.props.groups.map((group) => (
        <Region key={group.id} labelledBy={`group-${group.id}`} className={classNames.group}>
            <SectionHeader id={`group-${group.id}`} level={2} title={group.title} count={group.count} />
            {group.cards.map((card) => (
                <div key={card.provider} data-guide={`connections.${card.provider}`}>
                    <SurfaceListCard
                        label={card.title}
                        headingLevel={3}
                        fact={card.fact}
                        {...(props.props.canManage
                            ? { labelEnd: <props.renderAddButton provider={card.provider} kind="add" /> }
                            : {})}
                    >
                        {card.rows.map((row) => (
                            <props.renderRow
                                key={row.connection.id}
                                connection={row.connection}
                                agentNames={row.agentNames}
                                localOnly={props.props.localOnly}
                                ownerEmail={props.props.ownerEmail}
                                agents={props.props.agents}
                                canManage={props.props.canManage}
                            />
                        ))}
                    </SurfaceListCard>
                </div>
            ))}
        </Region>
    ))
