import {
    Breadcrumbs,
    Button,
    PageContainer,
    SearchField,
    SectionHeader,
    Select,
    Tabs,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { BreadcrumbItem } from "@starci/grammar/common"
import { OwnerGroupList } from "@/components/composites/OwnerGroupList"
import type { OwnerGroupListLabels } from "@/components/composites/OwnerGroupList"
import { SlotView } from "@/components/composites/SlotView"
import type { OwnerGroupView } from "@/hooks/responsibilities"
import type { DataSlot, SlotLabels } from "@/modules/types"
import {
    BOARD_CLASS,
    FILTERS_CLASS,
    HEAD_CLASS,
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
        readonly eyebrow: string
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
        readonly slot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        readonly groups: ReadonlyArray<OwnerGroupView>
        readonly groupLabels: OwnerGroupListLabels
        readonly emptyMessage: string
        readonly emptyDescription: string
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

/** Draws the responsibility board: filter cards, status tabs with counts, search and sort over the owner-grouped rows. */
export const ResponsibilitiesBoardBase = (props: ResponsibilitiesBoardBaseProps) => {
    const view = props.props
    return (
        <PageContainer measure="product">
            <div className={PAGE_CLASS}>
                <div className={HEAD_CLASS}>
                    <Breadcrumbs label={view.crumbLabel} items={view.crumbs} />
                    <SectionHeader
                        level={1}
                        eyebrow={view.eyebrow}
                        title={view.title}
                        description={view.description}
                        action={
                            <Button variant="primary" href={view.newLeadHref}>
                                {view.newLeadLabel}
                            </Button>
                        }
                    />
                </div>
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
                    <SlotView slot={view.slot} placeholder={false} labels={view.slotLabels} onRetry={props.on.retry}>
                        {(_, isSkeleton) => (
                            <OwnerGroupList
                                isLoading={isSkeleton}
                                groups={view.groups}
                                labels={view.groupLabels}
                                emptyMessage={view.emptyMessage}
                                emptyDescription={view.emptyDescription}
                                draftingId={view.draftingId}
                                copiedId={view.copiedId}
                                onDraft={props.on.draft}
                                onCopy={props.on.copy}
                            />
                        )}
                    </SlotView>
                </div>
            </div>
        </PageContainer>
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
                <Button variant="ghost" onPress={props.on.toggleFilters}>
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
