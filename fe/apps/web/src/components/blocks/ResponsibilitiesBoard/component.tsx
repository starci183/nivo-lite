import { Button, Page, SearchField, Select, Tabs, Text, TextAction } from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { OwnerGroupList } from "@/components/composites/OwnerGroupList"
import type { OwnerGroupListLabels } from "@/components/composites/OwnerGroupList"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, OwnerGroupView, ResponsibilityRowView, SlotLabels } from "@/modules/types"
import {
    BOARD_CLASS,
    FILTERS_CLASS,
    LIST_HEAD_CLASS,
    LIST_TITLE_CLASS,
    PAGE_CLASS,
    SEARCH_CLASS,
    SORT_CLASS,
    TOOLBAR_CLASS,
    TOOLBAR_END_CLASS,
} from "./classNames"

/** One choice of a select or one tab. */
export interface ResponsibilityChoiceView {
    readonly id: string
    readonly label: string
}

/** Copy, values and state of the responsibility board. */
export interface ResponsibilitiesBoardBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly title: string
        readonly description: string
        readonly newLeadLabel: string
        readonly newLeadHref: string
        readonly showFilters: boolean
        readonly ownerLabel: string
        readonly owners: ReadonlyArray<ResponsibilityChoiceView>
        readonly owner: string
        readonly dueLabel: string
        readonly dues: ReadonlyArray<ResponsibilityChoiceView>
        readonly due: string
        readonly clearLabel: string
        readonly isFiltered: boolean
        readonly tabsLabel: string
        readonly tabs: ReadonlyArray<ResponsibilityChoiceView>
        readonly status: string
        readonly searchLabel: string
        readonly searchPlaceholder: string
        readonly query: string
        readonly filtersLabel: string
        readonly sortLabel: string
        readonly sorts: ReadonlyArray<ResponsibilityChoiceView>
        readonly sort: string
        readonly listTitle: string
        readonly count: string
        readonly verifiedLabel: string
        readonly slot: DataSlot<ReadonlyArray<OwnerGroupView>>
        readonly slotLabels: SlotLabels
        readonly groupLabels: OwnerGroupListLabels
        readonly draftingId: string | null
        readonly copiedId: string | null
    }
    readonly on: {
        readonly owner: (value: string | null) => void
        readonly due: (value: string | null) => void
        readonly clear: () => void
        readonly status: (key: string) => void
        readonly query: (value: string) => void
        readonly toggleFilters: () => void
        readonly sort: (value: string | null) => void
        readonly draft: (responsibilityId: string) => void
        readonly copy: (responsibilityId: string, leadId: string) => void
        readonly retry: () => void
    }
}

/** Fake rows of the same shape: the skeleton reuses the ready tree. */
const PLACEHOLDER_ROW: ResponsibilityRowView = {
    id: "placeholder-row",
    leadId: "placeholder-lead",
    customer: "…",
    title: "…",
    nextAction: "…",
    dueLabel: "…",
    dueAt: null,
    createdAt: "",
    isOverdue: false,
    isDueToday: false,
    isDueThisWeek: false,
    status: "open",
    statusLabel: "…",
    ownerKey: "placeholder-owner",
    ownerName: "…",
    ownerKind: "human",
    ownerHandle: null,
}

/** What the owner groups draw while their read is in flight: one owner with two rows. */
const OWNER_GROUPS_PLACEHOLDER: ReadonlyArray<OwnerGroupView> = [
    {
        key: "placeholder-owner",
        name: "…",
        kind: "human",
        handle: null,
        glyph: "moduleChatbot",
        avatarUrl: null,
        rows: [PLACEHOLDER_ROW, { ...PLACEHOLDER_ROW, id: "placeholder-row-2" }],
    },
]

/** Draws the responsibility board: filter cards, status tabs with counts, search and sort over the owner-grouped rows. */
export const ResponsibilitiesBoardBase = (props: ResponsibilitiesBoardBaseProps) => {
    const view = props.props
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: { label: view.crumbLabel, items: view.crumbs },
                title: view.title,
                description: view.description,
                actions: (
                    <Button intent="commit" href={view.newLeadHref}>
                        {view.newLeadLabel}
                    </Button>
                ),
            }}
        >
            <div className={PAGE_CLASS}>
                <div className={BOARD_CLASS}>
                    {view.showFilters ? (
                        <div className={FILTERS_CLASS}>
                            <Select
                                label={view.ownerLabel}
                                options={view.owners}
                                value={view.owner}
                                onValueChange={props.on.owner}
                            />
                            <Select
                                label={view.dueLabel}
                                options={view.dues}
                                value={view.due}
                                onValueChange={props.on.due}
                            />
                            <div>
                                <TextAction onPress={props.on.clear} isDisabled={!view.isFiltered}>
                                    {view.clearLabel}
                                </TextAction>
                            </div>
                        </div>
                    ) : null}
                    <ResponsibilityToolbar {...props} />
                    <div className={LIST_HEAD_CLASS}>
                        <div className={LIST_TITLE_CLASS}>
                            <Text weight="semibold">{view.listTitle}</Text>
                            <Text size="sm" tone="muted">
                                {view.count}
                            </Text>
                        </div>
                        <Text size="xs" tone="muted">
                            {view.verifiedLabel}
                        </Text>
                    </div>
                    <SlotView
                        slot={view.slot}
                        placeholder={OWNER_GROUPS_PLACEHOLDER}
                        labels={view.slotLabels}
                        onRetry={props.on.retry}
                    >
                        {(groups, isSkeleton) => (
                            <OwnerGroupList
                                isSkeleton={isSkeleton}
                                groups={groups}
                                labels={view.groupLabels}
                                draftingId={view.draftingId}
                                copiedId={view.copiedId}
                                onDraft={props.on.draft}
                                onCopy={props.on.copy}
                            />
                        )}
                    </SlotView>
                </div>
            </div>
        </Page>
    )
}

/** Renders the ResponsibilityToolbar section. */
const ResponsibilityToolbar = (props: ResponsibilitiesBoardBaseProps) => {
    const view = props.props
    return (
        <div className={TOOLBAR_CLASS}>
            <Tabs
                variant="primary"
                label={view.tabsLabel}
                selectedKey={view.status}
                inset="none"
                labelVisibility="always"
                items={view.tabs}
                onSelect={props.on.status}
            />
            <div className={TOOLBAR_END_CLASS}>
                <div className={SEARCH_CLASS}>
                    <SearchField
                        label={view.searchLabel}
                        isLabelHidden
                        placeholder={view.searchPlaceholder}
                        value={view.query}
                        onValueChange={props.on.query}
                        onClear={() => props.on.query("")}
                    />
                </div>
                <Button intent="neutral" onPress={props.on.toggleFilters}>
                    {view.filtersLabel}
                </Button>
                <div className={SORT_CLASS}>
                    <Select
                        label={view.sortLabel}
                        isLabelHidden
                        options={view.sorts}
                        value={view.sort}
                        onValueChange={props.on.sort}
                    />
                </div>
            </div>
        </div>
    )
}
