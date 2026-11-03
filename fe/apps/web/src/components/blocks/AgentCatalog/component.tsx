import { AGENT_MARK_MASCOT_SRC } from "@/components/leaves/AgentMark"
import { FilterButtonGroup, EmptyNotice, Grid, SearchField, SurfaceCard, Section } from "@starci/grammar/common"
import type { BadgeTone, ListRowData } from "@starci/grammar/common"
import { AgentCatalogCard, type AgentCatalogCardProps } from "@/components/composites/AgentCatalogCard"
import { AgentTeamRow } from "@/components/composites/AgentTeamRow"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** What one installed agent shows on the catalogue, already in the reader language. */
export interface AgentCatalogTeamRow {
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    /** "role · channel", already joined. */
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** "Setup 3/8". */
    readonly progressLabel: string
    readonly confirmed: number
    readonly total: number
    /** "Continue setup" while gates are open, else "Open". */
    readonly actionLabel: string
    readonly href: string
}

/** One installed agent of the first section with the key the row is listed by. */
export interface AgentCatalogTeamEntry {
    readonly key: string
    readonly row: AgentCatalogTeamRow
}

/** The list item of one installed agent: its identity and status, with the setup progress as the detail. */
const teamItemOf = (row: AgentCatalogTeamRow, id: string, detail: ListRowData["detail"]): ListRowData => ({
    id,
    title: row.name,
    description: row.description,
    leading: { avatar: { name: row.name, seed: row.seed, src: row.avatarUrl || AGENT_MARK_MASCOT_SRC, kind: "agent" } },
    badges: [{ label: row.statusLabel, tone: row.statusTone, isDot: true }],
    action: { label: row.actionLabel, intent: "neutral", href: row.href },
    detail,
})

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
            teamItemOf(entry.row, entry.key, <AgentTeamRow {...entry.row} isLoading={props.isLoading} />),
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
