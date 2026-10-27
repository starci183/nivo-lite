import { Alert, EmptyNotice, Region, SectionHeader, SurfaceListCard } from "@starci/grammar/common"
import type { ComponentType } from "react"
import type { AgentOption, Connection, DataSlot, Provider, SlotLabels } from "@/modules/types"
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
    readonly ownerOnly: string
    readonly emptyTitle: string
    readonly emptyHint: string
    readonly automationsLink: string
    readonly automationsHref: string
}

/** What the board draws once the workspace reads are in. */
export interface ConnectionsBoard {
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

/** What the overview draws: its words, and the board the workspace reads fill. */
export interface ConnectionsOverviewProps {
    readonly props: {
        readonly words: PageWords
        /** The summary line under the heading; null until the workspace reads are in. */
        readonly summary: string | null
        /** The board of connections: loading, failed, forbidden to staff, or ready. */
        readonly board: DataSlot<ConnectionsBoard>
        readonly slotLabels: SlotLabels
    }
    readonly on: {
        readonly retry: () => void
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
    readonly props: ConnectionsBoard
    readonly renderAddButton: ConnectionsOverviewProps["renderAddButton"]
    readonly renderRow: ConnectionsOverviewProps["renderRow"]
    /** The cards are drawn as placeholders while the workspace reads are on their way. */
    readonly isSkeleton: boolean
}

/** Provider cards and their connection rows, using the blocks supplied by the feature host. */
export const ConnectionsLists = (props: ConnectionsListsProps) =>
    props.props.groups.map((group) => (
        <Region key={group.id} labelledBy={`group-${group.id}`} className={classNames.group}>
            <SectionHeader id={`group-${group.id}`} level={2} title={group.title} count={group.count} />
            {group.cards.map((card) => (
                <div key={card.provider} data-guide={`connections.${card.provider}`}>
                    <SurfaceListCard
                        isLoading={props.isSkeleton}
                        loadingRows={2}
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

/** The board drawn while the workspace reads are on their way: the same list with no connection in it yet. */
export const BOARD_PLACEHOLDER: ConnectionsBoard = {
    view: "connected",
    ownerEmail: "",
    canManage: false,
    localOnly: false,
    items: [],
    agents: [],
    agentNames: {},
    liveCount: 1,
    attention: null,
    groups: [
        {
            id: "placeholder",
            title: "",
            count: 0,
            cards: [{ provider: "sepay", title: "", fact: "", rows: [] }],
        },
    ],
}

/** The overview, the board it draws and whether that board is a placeholder. */
interface BoardBodyProps extends ConnectionsOverviewProps {
    readonly board: ConnectionsBoard
    readonly isSkeleton: boolean
}

/** The first card of the board that needs the owner, then the tabs and the lists of the chosen view. */
export const BoardBody = (props: BoardBodyProps) => {
    const { board } = props
    return (
        <>
            {board.attention === null ? null : (
                <props.renderAttention
                    connection={board.attention.first}
                    count={board.attention.count}
                    canManage={board.canManage}
                />
            )}
            {board.canManage ? null : <Alert tone="informative" title={props.props.words.ownerOnly} />}
            <props.renderViewTabs selected={board.view} liveCount={board.liveCount} />
            {board.view === "library" ? <props.renderLibrary items={board.items} /> : null}
            {board.view === "connected" && board.liveCount === 0 ? (
                <EmptyNotice message={props.props.words.emptyTitle} description={props.props.words.emptyHint} />
            ) : null}
            {board.view === "connected" ? (
                <ConnectionsLists
                    props={board}
                    renderAddButton={props.renderAddButton}
                    renderRow={props.renderRow}
                    isSkeleton={props.isSkeleton}
                />
            ) : null}
        </>
    )
}
