import { Badge, Button, Page, Pane, PaneGrid, Text } from "@starci/grammar/common"
import type { BadgeTone, ListBoxSection, PageHeaderBreadcrumbs } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { PermissionGrantsFields } from "@/components/branches/PermissionGrantsFields"
import type { PermissionGrantsFieldsProps } from "@/components/branches/PermissionGrantsFields"
import { FilterGroup } from "@/components/composites/FilterGroup"
import { PaneBlank } from "@/components/composites/PaneBlank"
import { PaneSections } from "@/components/composites/PaneSections"
import { PaneHead } from "@/components/composites/PaneHead"
import { PermissionRuleForm } from "@/components/composites/PermissionRuleForm"
import type { PermissionRuleFormProps } from "@/components/composites/PermissionRuleForm"
import { PaneBody } from "@/components/frames/PaneBody"
import { Icon } from "@/components/leaves/Icon"
import type { DataSlot, PaneGridLayout, SlotLabels } from "@/modules/types"

/** One rule of the list, every word already resolved. */
export interface PermissionRowView {
    readonly id: string
    readonly title: string
    /** The agents it covers, whom it asks and how they decide, on one line. */
    readonly description: string
    readonly modeLabel: string
    readonly modeTone: BadgeTone
    /** The department that groups the rule in the list. */
    readonly departmentLabel: string
}

/** The words of the permission panes, resolved once by the connected block. */
export interface PermissionPanesCopy {
    readonly grid: string
    /** The trail of the page: the dashboard, the team, then the permissions. */
    readonly breadcrumbs: PageHeaderBreadcrumbs
    readonly title: string
    readonly description: string
    readonly tabsLabel: string
    readonly membersTab: string
    readonly membersHref: string
    readonly permissionsTab: string
    readonly permissionsHref: string
    readonly inviteAction: string
    readonly listTitle: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly footnote: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly noMatchTitle: string
    readonly back: string
}

/** Copy, rows and state the connected permission panes supply. */
export interface PermissionPanesBaseProps {
    readonly props: {
        readonly copy: PermissionPanesCopy
        readonly grid: PaneGridLayout
        /** Staff may read the list but not open a rule. */
        readonly isLocked: boolean
        readonly slot: DataSlot<ReadonlyArray<PermissionRowView>>
        readonly placeholder: ReadonlyArray<PermissionRowView>
        readonly labels: SlotLabels
        readonly query: string
        readonly openedId: string | null
        /** The rule form while a rule is open; null when none is. */
        readonly form: PermissionRuleFormProps["props"] | null
        readonly grantsSlot: DataSlot<PermissionGrantsFieldsProps["props"]["grants"]>
        readonly grantsPlaceholder: PermissionGrantsFieldsProps["props"]["grants"]
        readonly grantsLabels: SlotLabels
    }
    readonly on: PermissionRuleFormProps["on"] & {
        readonly setQuery: (value: string) => void
        readonly openInvite: () => void
        readonly open: (id: string) => void
        readonly retry: () => void
        readonly retryGrants: () => void
    }
}

type Props = PermissionPanesBaseProps

/** The rows the search lets through. */
const matching = (rows: ReadonlyArray<PermissionRowView>, query: string): ReadonlyArray<PermissionRowView> => {
    const needle = query.trim().toLowerCase()
    return needle === "" ? rows : rows.filter((row) => `${row.title} ${row.description}`.toLowerCase().includes(needle))
}

/** What the list pane's body draws once the rules are read. */
interface ListBodyProps {
    readonly base: Props
    readonly rows: ReadonlyArray<PermissionRowView>
    readonly isSkeleton: boolean
}

/** The rows grouped by department, in the order the rules came: the work, whom it asks, and the mode the rule has now. */
const sectionsOf = (rows: ReadonlyArray<PermissionRowView>): ReadonlyArray<ListBoxSection> =>
    [...new Set(rows.map((row) => row.departmentLabel))].map((department) => ({
        id: department,
        label: department,
        items: rows
            .filter((row) => row.departmentLabel === department)
            .map((row) => ({
                id: row.id,
                label: row.title,
                description: row.description === "" ? undefined : row.description,
                trailing: <Badge tone={row.modeTone}>{row.modeLabel}</Badge>,
            })),
    }))

/** The list pane's body: the search, the sections of rules and the footnote, each part geometry while the rules load. */
const ListBody = (props: ListBodyProps) => {
    const { copy } = props.base.props
    return (
        <>
            <FilterGroup
                isLoading={props.isSkeleton}
                search={{
                    label: copy.searchLabel,
                    placeholder: copy.searchPlaceholder,
                    clearLabel: copy.clearSearch,
                    value: props.base.props.query,
                    onChange: props.base.on.setQuery,
                }}
            />
            <PaneSections
                label={copy.listLabel}
                sections={sectionsOf(matching(props.rows, props.base.props.query))}
                selectedId={props.base.props.openedId}
                onSelect={props.base.on.open}
                empty={<Text tone="muted">{copy.noMatchTitle}</Text>}
                isLoading={props.isSkeleton}
            />
            <Text size="xs" tone="muted" isLoading={props.isSkeleton}>
                {copy.footnote}
            </Text>
        </>
    )
}

/** The main pane: the form of the open rule with its approval limits, or the blank that asks for a choice. */
const MainBody = (props: Props) => {
    const form = props.props.form
    if (form === null) return <PaneBlank message={props.props.copy.pickTitle} description={props.props.copy.pickBody} frame="frameless" />
    return (
        <PaneBody>
            <PermissionRuleForm
                props={form}
                on={props.on}
                shape={{
                    grants: (
                        <SlotView
                            slot={props.props.grantsSlot}
                            placeholder={props.props.grantsPlaceholder}
                            labels={props.props.grantsLabels}
                            onRetry={props.on.retryGrants}
                            render={(grants, isLoading) => (
                                <PermissionGrantsFields
                                    isLoading={isLoading}
                                    props={{ grants, canGrant: form.canGrant, copy: form.copy }}
                                    on={{ enabled: props.on.grantEnabled, max: props.on.grantMax }}
                                />
                            )}
                        />
                    ),
                }}
            />
        </PaneBody>
    )
}

/** The page header: the team's title and line, the Members / Permissions tabs and the one command that invites. */
const headerOf = (props: Props) => {
    const { copy } = props.props
    return {
        breadcrumbs: copy.breadcrumbs,
        title: copy.title,
        description: copy.description,
        actions: (
            <Button
                intent="commit"
                startContent={<Icon props={{ name: "add", usage: "leading" }} />}
                onPress={props.on.openInvite}
            >
                {copy.inviteAction}
            </Button>
        ),
        tabs: {
            label: copy.tabsLabel,
            selectedKey: "permissions",
            labelVisibility: "always" as const,
            items: [
                { id: "members", label: copy.membersTab, href: copy.membersHref },
                { id: "permissions", label: copy.permissionsTab, href: copy.permissionsHref },
            ],
        },
    }
}

/** Draws the permissions as the chat pattern: the rules by department beside the open rule's form; a phone shows one pane. */
export const PermissionPanesBase = (props: PermissionPanesBaseProps) => {
    const { copy, grid } = props.props
    return (
        <Page chrome="panes" header={headerOf(props)}>
            <PaneGrid label={copy.grid} areas={grid.areas} columns={grid.columns} rows={grid.rows}>
                <Pane area="listHead" surface>
                    <PaneHead title={copy.listTitle} />
                </Pane>
                <Pane area="list" surface scroll label={copy.listLabel}>
                    <PaneBody>
                        <SlotView
                            slot={props.props.slot}
                            placeholder={props.props.placeholder}
                            labels={props.props.labels}
                            onRetry={props.on.retry}
                            render={(rows, isSkeleton) => <ListBody base={props} rows={rows} isSkeleton={isSkeleton} />}
                        />
                    </PaneBody>
                </Pane>
                <Pane area="head" surface>
                    <PaneHead
                        title={props.props.form?.title ?? copy.detailLabel}
                        headingLevel={2}
                        back={{ label: copy.back, onPress: props.on.close }}
                    />
                </Pane>
                <Pane area="main" scroll content="cards" label={copy.detailLabel}>
                    <MainBody {...props} />
                </Pane>
            </PaneGrid>
        </Page>
    )
}
