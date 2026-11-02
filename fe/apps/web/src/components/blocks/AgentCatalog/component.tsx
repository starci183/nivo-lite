import { AGENT_MARK_MASCOT_SRC } from "@/components/leaves/AgentMark"
import { FilterButtonGroup, EmptyNotice, Grid, SearchField, SurfaceCard, Section } from "@starci/grammar/common"
import { AgentCatalogCard, type AgentCatalogCardProps } from "@/components/composites/AgentCatalogCard"
import { AgentTeamRow } from "@/components/composites/AgentTeamRow"
import { agentTeamItemOf, type AgentTeamRowData } from "@/modules/team"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** One installed agent of the first section with the key the row is listed by. */
export interface AgentCatalogTeamEntry {
    readonly key: string
    readonly row: Omit<AgentTeamRowData, "isLoading">
}

/** One role card of the second section with the key the handlers name it by. */
export interface AgentCatalogRoleEntry {
    readonly key: string
    readonly card: Omit<AgentCatalogCardProps, "onInstall" | "isInstalling" | "isBlocked" | "isLoading">
}

/** What the catalogue lists once the installations arrived: the installed agents and the roles that match the filters. */
export interface AgentCatalogData {
    readonly team: ReadonlyArray<AgentCatalogTeamEntry>
    readonly roles: ReadonlyArray<AgentCatalogRoleEntry>
}

/** Copy, state and commands of the agent catalogue. */
export interface AgentCatalogBaseProps {
    readonly props: {
        readonly yoursTitle: string
        readonly yoursEmptyTitle: string
        readonly yoursEmptyHint: string
        readonly addTitle: string
        /** The anchor of the roles heading, the target of the header's create action. */
        readonly addId: string
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly clearLabel: string
        readonly query: string
        readonly categoryLabel: string
        readonly categoryOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
        readonly category: string
        readonly emptyTitle: string
        readonly emptyHint: string
        readonly emptyAction: string | undefined
        readonly slot: DataSlot<AgentCatalogData>
        /** Fake entries of the same shape: the skeleton reuses the ready tree. */
        readonly placeholder: AgentCatalogData
        readonly slotLabels: SlotLabels
        readonly busyKey: string | null
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly category: (value: string) => void
        readonly clear: () => void
        readonly retry: () => void
        readonly install: (key: string) => void
    }
}

/** The base props of the catalogue with the data of a ready (or placeholder) slot. */
interface CatalogSectionProps extends AgentCatalogBaseProps {
    readonly data: AgentCatalogData
    readonly isLoading: boolean
}

/** What the team section reads: its words, the installed agents and whether they are placeholders. */
interface TeamProps {
    readonly title: string
    readonly emptyTitle: string
    readonly emptyHint: string
    readonly data: AgentCatalogData
    readonly isLoading: boolean
}

/** The installed agents as rows of one list card: progress, status and the next step on each. */
const Team = (props: TeamProps) => (
    <SurfaceCard
        kind="list"
        label={props.title}
        headingLevel={2}
        fact={String(props.data.team.length)}
        isLoading={props.isLoading}
        items={props.data.team.map((entry) =>
            agentTeamItemOf(
                { ...entry.row, avatarUrl: entry.row.avatarUrl || AGENT_MARK_MASCOT_SRC },
                entry.key,
                <AgentTeamRow {...entry.row} isLoading={props.isLoading} />,
            ),
        )}
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyHint} />}
    />
)

/** The roles that can be added: the heading with the search, the group filter chips, the compact role cards. */
const Roles = (props: CatalogSectionProps) => (
    <Section
        title={props.props.addTitle}
        isLoading={props.isLoading}
        action={
            <SearchField
                label={props.props.searchLabel}
                isLabelHidden
                placeholder={props.props.searchPlaceholder}
                clearLabel={props.props.clearLabel}
                value={props.props.query}
                onValueChange={props.on.query}
                isLoading={props.isLoading}
            />
        }
        id={props.props.addId}
    >
        <FilterButtonGroup
            label={props.props.categoryLabel}
            isLoading={props.isLoading}
            options={props.props.categoryOptions.map((option) => ({ value: option.value, label: option.label }))}
            value={props.props.category}
            onValueChange={props.on.category}
        />
        {props.data.roles.length === 0 ? (
            <EmptyNotice
                message={props.props.emptyTitle}
                description={props.props.emptyHint}
                {...(props.props.emptyAction === undefined
                    ? {}
                    : { actionLabel: props.props.emptyAction, onAction: props.on.clear })}
            />
        ) : (
            <Grid kind="cards" columns={3}>
                {props.data.roles.map((entry) => (
                    <AgentCatalogCard
                        key={entry.key}
                        {...entry.card}
                        isLoading={props.isLoading}
                        isInstalling={props.props.busyKey === entry.key}
                        isBlocked={props.props.busyKey !== null}
                        onInstall={() => props.on.install(entry.key)}
                    />
                ))}
            </Grid>
        )}
    </Section>
)

/**
 * Draws the catalogue as the Page body's own regions (a fragment, so the page's region step spaces them): the installed
 * agents as rows, then the roles to add.
 */
export const AgentCatalogBase = (props: AgentCatalogBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(data, isLoading) => (
            <>
                <Team
                    title={props.props.yoursTitle}
                    emptyTitle={props.props.yoursEmptyTitle}
                    emptyHint={props.props.yoursEmptyHint}
                    data={data}
                    isLoading={isLoading}
                />
                <Roles {...props} data={data} isLoading={isLoading} />
            </>
        )}
    />
)
