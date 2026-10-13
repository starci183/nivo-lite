import {
    Alert,
    EmptyNotice,
    PageContainer,
    Region,
    SectionHeader,
    Skeleton,
    SurfaceListCard,
    TextAction,
} from "@starci/grammar/common"
import { ConnectionAddButton } from "@/components/blocks/ConnectionAddButton"
import { ConnectionAttention } from "@/components/blocks/ConnectionAttention"
import { ConnectionLibrary } from "@/components/blocks/ConnectionLibrary"
import { ConnectionRow } from "@/components/blocks/ConnectionRow"
import { ConnectionViewTabs } from "@/components/blocks/ConnectionViewTabs"
import { ConnectionsHead } from "@/components/composites/ConnectionsHead"
import { ConnectionWizardOverlay } from "@/features/overlays/ConnectionWizardOverlay"
import { ConnectorDetailOverlay } from "@/features/overlays/ConnectorDetailOverlay"
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

/** The words of the page, resolved by the connected block. */
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

/** What the overview draws: its words, the signed-in viewer and what the block loaded. */
export interface ConnectionsOverviewBaseProps {
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
}

const listsOf = (props: ConnectionsOverviewBaseProps["props"]) =>
    props.groups.map((group) => (
        <Region key={group.id} labelledBy={`group-${group.id}`} className={classNames.group}>
            <SectionHeader id={`group-${group.id}`} level={2} title={group.title} count={group.count} />
            {group.cards.map((card) => (
                <div key={card.provider} data-guide={`connections.${card.provider}`}>
                    <SurfaceListCard
                        label={card.title}
                        headingLevel={3}
                        fact={card.fact}
                        {...(props.canManage
                            ? { labelEnd: <ConnectionAddButton provider={card.provider} kind="add" /> }
                            : {})}
                    >
                        {card.rows.map((row) => (
                            <ConnectionRow
                                key={row.connection.id}
                                connection={row.connection}
                                agentNames={row.agentNames}
                                localOnly={props.localOnly}
                                ownerEmail={props.ownerEmail}
                                agents={props.agents}
                                canManage={props.canManage}
                            />
                        ))}
                    </SurfaceListCard>
                </div>
            ))}
        </Region>
    ))

const headOf = (props: ConnectionsOverviewBaseProps["props"], withSummary: boolean) => (
    <ConnectionsHead
        crumbLabel={props.words.crumbLabel}
        homeLabel={props.words.crumbHome}
        homeHref={props.words.homeHref}
        title={props.words.title}
        description={props.words.description}
        {...(withSummary ? { meta: props.words.summary } : {})}
    />
)

/**
 * The Connections page: the trail and heading, the first connection that needs attention, the Connected / Library tabs, then either
 * the library or the provider lists grouped by what they bring in. The wizard and the connector detail open as drawers over it.
 */
export const ConnectionsOverviewBase = (props: ConnectionsOverviewBaseProps) => {
    const page = props.props
    if (page.mode === "forbidden") {
        return (
            <PageContainer measure="product">
                <div className={classNames.page}>
                    <SectionHeader level={1} title={page.words.forbiddenTitle} description={page.words.forbiddenBody} />
                    <TextAction href={page.words.forbiddenHref}>{page.words.forbiddenBack}</TextAction>
                </div>
            </PageContainer>
        )
    }
    if (page.mode === "loading") {
        return (
            <PageContainer measure="product">
                <div className={classNames.page}>
                    {headOf(page, false)}
                    <Skeleton shape="text" lines={4} />
                </div>
            </PageContainer>
        )
    }
    if (page.mode === "failed") {
        return (
            <PageContainer measure="product">
                <div className={classNames.page}>
                    {headOf(page, false)}
                    <Alert tone="negative" title={page.words.loadFailed} />
                </div>
            </PageContainer>
        )
    }
    return (
        <PageContainer measure="product">
            <div className={classNames.page}>
                {headOf(page, true)}
                {page.attention === null ? null : (
                    <ConnectionAttention
                        connection={page.attention.first}
                        count={page.attention.count}
                        canManage={page.canManage}
                    />
                )}
                {page.canManage ? null : <Alert tone="informative" title={page.words.ownerOnly} />}
                <ConnectionViewTabs selected={page.view} liveCount={page.liveCount} />
                {page.view === "library" ? <ConnectionLibrary items={page.items} /> : null}
                {page.view === "connected" && page.liveCount === 0 ? (
                    <EmptyNotice message={page.words.emptyTitle} description={page.words.emptyHint} />
                ) : null}
                {page.view === "connected" ? listsOf(page) : null}
                <TextAction href={page.words.automationsHref}>{page.words.automationsLink}</TextAction>
                <ConnectionWizardOverlay items={page.items} agents={page.agents} ownerEmail={page.ownerEmail} />
                <ConnectorDetailOverlay
                    items={page.items}
                    agentNames={page.agentNames}
                    agents={page.agents}
                    localOnly={page.localOnly}
                    ownerEmail={page.ownerEmail}
                    canManage={page.canManage}
                />
            </div>
        </PageContainer>
    )
}
