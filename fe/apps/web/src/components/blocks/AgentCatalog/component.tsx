import { EmptyNotice, Region, SearchField, SectionHeader, SurfaceListCard, TagGroup } from "@starci/grammar/common"
import { AgentCatalogCard, type AgentCatalogCardProps } from "@/components/composites/AgentCatalogCard"
import { AgentTeamRow, type AgentTeamRowProps } from "@/components/composites/AgentTeamRow"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { GRID } from "./classNames"

/** One installed agent of the first section with the key the row is listed by. */
export interface AgentCatalogTeamEntry {
    readonly key: string
    readonly row: Omit<AgentTeamRowProps, "isSkeleton">
}

/** One role card of the second section with the key the handlers name it by. */
export interface AgentCatalogRoleEntry {
    readonly key: string
    readonly card: Omit<AgentCatalogCardProps, "onInstall" | "isInstalling" | "isBlocked" | "isSkeleton">
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
    readonly isSkeleton: boolean
}

/** What the team section reads: its words, the installed agents and whether they are placeholders. */
interface TeamProps {
    readonly title: string
    readonly emptyTitle: string
    readonly emptyHint: string
    readonly data: AgentCatalogData
    readonly isSkeleton: boolean
}

/** The installed agents as rows of one list card: progress, status and the next step on each. */
const Team = (props: TeamProps) => (
    <SurfaceListCard
        label={props.title}
        headingLevel={2}
        {...(props.isSkeleton ? {} : { fact: String(props.data.team.length) })}
        isLoading={props.isSkeleton}
        loadingRows={2}
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyHint} />}
    >
        {props.data.team.map((entry) => (
            <AgentTeamRow key={entry.key} {...entry.row} isSkeleton={props.isSkeleton} />
        ))}
    </SurfaceListCard>
)

/** The roles that can be added: the heading with the search, the group filter chips, the compact role cards. */
const Roles = (props: CatalogSectionProps) => (
    <>
        <SectionHeader
            id={props.props.addId}
            title={props.props.addTitle}
            isSkeleton={props.isSkeleton}
            action={
                <SearchField
                    label={props.props.searchLabel}
                    isLabelHidden
                    placeholder={props.props.searchPlaceholder}
                    clearLabel={props.props.clearLabel}
                    value={props.props.query}
                    onValueChange={props.on.query}
                    isSkeleton={props.isSkeleton}
                />
            }
        />
        <TagGroup
            label={props.props.categoryLabel}
            selectionMode="single"
            size="sm"
            isSkeleton={props.isSkeleton}
            items={props.props.categoryOptions.map((option) => ({ id: option.value, label: option.label }))}
            selectedIds={[props.props.category]}
            onSelectionChange={(ids) => {
                const picked = ids[0]
                if (picked !== undefined) props.on.category(picked)
            }}
        />
        <Region labelledBy={props.props.addId}>
            {props.data.roles.length === 0 ? (
                <EmptyNotice
                    message={props.props.emptyTitle}
                    description={props.props.emptyHint}
                    {...(props.props.emptyAction === undefined
                        ? {}
                        : { actionLabel: props.props.emptyAction, onAction: props.on.clear })}
                />
            ) : (
                <div className={GRID}>
                    {props.data.roles.map((entry) => (
                        <AgentCatalogCard
                            key={entry.key}
                            {...entry.card}
                            isSkeleton={props.isSkeleton}
                            isInstalling={props.props.busyKey === entry.key}
                            isBlocked={props.props.busyKey !== null}
                            onInstall={() => props.on.install(entry.key)}
                        />
                    ))}
                </div>
            )}
        </Region>
    </>
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
    >
        {(data, isSkeleton) => (
            <>
                <Team
                    title={props.props.yoursTitle}
                    emptyTitle={props.props.yoursEmptyTitle}
                    emptyHint={props.props.yoursEmptyHint}
                    data={data}
                    isSkeleton={isSkeleton}
                />
                <Roles {...props} data={data} isSkeleton={isSkeleton} />
            </>
        )}
    </SlotView>
)
