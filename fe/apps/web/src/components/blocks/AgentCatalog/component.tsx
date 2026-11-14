import {
    Cluster,
    EmptyNotice,
    Grid,
    SearchField,
    Section,
    SurfaceCard,
    Tabs,
    type ListRowData,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { AgentCard, RemoveConfirm } from "./cards"
import type { AgentCatalogBaseProps, AgentCatalogData, RoleEntryView } from "./types"

export type { AgentCatalogBaseProps, AgentCatalogData } from "./types"

/** The base props of the catalogue with the data of a ready (or placeholder) slot. */
interface CatalogSectionProps extends AgentCatalogBaseProps {
    readonly data: AgentCatalogData
    readonly isLoading: boolean
}

/** The empty answer of the team: no agents at all, or none that match the filters. */
const TeamEmpty = (props: AgentCatalogBaseProps) =>
    props.props.filters[0]?.count === 0 ? (
        <EmptyNotice frame="card" message={props.props.noAgentsTitle} description={props.props.noAgentsHint} />
    ) : (
        <EmptyNotice
            frame="card"
            message={props.props.emptyTitle}
            description={props.props.emptyHint}
            actionLabel={props.props.emptyAction}
            onAction={props.on.clear}
        />
    )

/** The filter tabs and the search of a team larger than a person scans by eye, at the end of the section head. */
const TeamFilters = (props: AgentCatalogBaseProps) => (
    <Cluster gap="row">
        <Tabs
            kind="filter"
            label={props.props.filterLabel}
            items={props.props.filters.map((option) => ({ id: option.id, label: option.label, count: option.count }))}
            selectedKey={props.props.filter}
            onSelect={props.on.filter}
        />
        <SearchField
            label={props.props.searchLabel}
            placeholder={props.props.searchPlaceholder}
            clearLabel={props.props.searchClear}
            value={props.props.query}
            onValueChange={props.on.query}
            onClear={() => props.on.query("")}
        />
    </Cluster>
)

/** The installed agents: a head with their count (and the chips and the search when the team is large), then one card each, three to a row. */
const Team = (props: CatalogSectionProps) => (
    <Section
        title={props.props.yoursTitle}
        headingLevel={2}
        count={props.data.rows.length}
        {...(props.data.hasFilters ? { action: <TeamFilters props={props.props} on={props.on} /> } : {})}
        isLoading={props.isLoading}
    >
        {props.data.rows.length === 0 ? (
            <TeamEmpty props={props.props} on={props.on} />
        ) : (
            <Grid kind="cards" columns={3} gap="inline">
                {props.data.rows.map((row) => (
                    <AgentCard key={row.key} props={props.props} on={props.on} row={row} isLoading={props.isLoading} />
                ))}
            </Grid>
        )}
    </Section>
)

/** One role that can be added as a row: the mark of its kind, what it does and needs, its state and the install command. */
const roleRowOf = (entry: RoleEntryView, props: CatalogSectionProps): ListRowData => ({
    id: entry.key,
    title: entry.card.name,
    description: entry.card.description,
    leading: {
        avatar: { name: entry.card.name, src: `/agents/${entry.card.moduleKey}.webp`, shape: "square" },
        size: "sm",
    },
    badges: [{ label: entry.card.stateLabel, tone: entry.card.isInstalled ? "success" : "neutral" }],
    ...(entry.card.needsLabel === "" ? {} : { meta: { text: entry.card.needsLabel } }),
    ...(entry.card.canInstall
        ? {
              action: {
                  label: entry.card.installLabel,
                  intent: "neutral" as const,
                  isPending: props.props.busyKey === entry.key,
                  isDisabled: props.props.busyKey !== null,
                  press: () => props.on.install(entry.key),
              },
          }
        : {}),
})

/** The roles that can be added: one list card, the group chips in its filter zone, a row per role. */
const Roles = (props: CatalogSectionProps) => (
    <div id={props.props.addId}>
        <SurfaceCard
            kind="list"
            label={props.props.addTitle}
            headingLevel={2}
            isLoading={props.isLoading}
            headers={[
                {
                    kind: "filter",
                    label: props.props.categoryLabel,
                    items: props.props.categoryOptions.map((option) => ({
                        id: option.id,
                        label: option.label,
                        count: option.count,
                    })),
                    selectedKey: props.props.category,
                    onSelect: props.on.category,
                },
            ]}
            items={props.data.roles.map((entry) => roleRowOf(entry, props))}
            empty={<EmptyNotice message={props.props.rolesEmptyTitle} description={props.props.rolesEmptyHint} />}
        />
    </div>
)

/**
 * Draws the catalogue as the Page body own regions (a fragment, so the page region step spaces them): the installed agents as
 * one table with what each may use and read, then the roles to add.
 */
export const AgentCatalogBase = (props: AgentCatalogBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(data, isLoading) => (
            <>
                <Team {...props} data={data} isLoading={isLoading} />
                <RemoveConfirm props={props.props} on={props.on} />
                <Roles {...props} data={data} isLoading={isLoading} />
            </>
        )}
    />
)
