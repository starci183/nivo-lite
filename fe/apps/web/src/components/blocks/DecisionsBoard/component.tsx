import {
    Badge,
    Breadcrumbs,
    EmptyNotice,
    ListRow,
    PageContainer,
    SectionHeader,
    SurfaceListCard,
    Tabs,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { FILTERS, HEAD, PAGE, TABS } from "./classNames"

/** One filter tab. */
export interface FilterTabView {
    readonly id: string
    readonly label: string
}

/** One decision as the list draws it. */
export interface DecisionsBoardRowView {
    readonly id: string
    readonly actionLabel: string
    readonly outcomeLabel: string
    readonly outcomeTone: BadgeTone
    readonly when: string
    readonly departmentLabel: string
    readonly decider: string
    readonly reason: string | null
    readonly basis: string | null
    readonly note: string | null
    readonly leadHref: string | null
    readonly leadLabel: string
    readonly noLead: string
}

/** What the list shows once the data is in: the rows the filters let through and the line that counts them. */
export interface DecisionListView {
    readonly rows: ReadonlyArray<DecisionsBoardRowView>
    readonly count: string
    readonly isFiltered: boolean
}

/** Copy and state of the decision history. */
export interface DecisionsBoardBaseProps {
    readonly props: {
        readonly crumbLabel: string
        readonly crumbs: ReadonlyArray<BreadcrumbItem>
        readonly eyebrow: string
        readonly title: string
        readonly description: string
        readonly kindLabel: string
        readonly kindKey: string
        readonly kinds: ReadonlyArray<FilterTabView>
        readonly deptLabel: string
        readonly deptKey: string
        readonly depts: ReadonlyArray<FilterTabView>
        readonly listAria: string
        readonly slot: DataSlot<DecisionListView>
        readonly placeholder: DecisionListView
        readonly slotLabels: SlotLabels
        readonly noMatchTitle: string
        readonly noMatchBody: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly clearFilters: string
    }
    readonly on: {
        readonly kind: (key: string) => void
        readonly dept: (key: string) => void
        readonly clear: () => void
        readonly retry: () => void
    }
}

/** Draws the decision history: filters over a list that reads on a phone, of who decided what, when and with what result. */
export const DecisionsBoardBase = (props: DecisionsBoardBaseProps) => {
    const view = props.props
    return (
        <PageContainer measure="product">
            <div className={PAGE}>
                <div className={HEAD}>
                    <Breadcrumbs label={view.crumbLabel} items={view.crumbs} />
                    <SectionHeader level={1} eyebrow={view.eyebrow} title={view.title} description={view.description} />
                </div>
                <div className={FILTERS}>
                    <div className={TABS}>
                        <Tabs
                            variant="secondary"
                            label={view.kindLabel}
                            selectedKey={view.kindKey}
                            inset="none"
                            labelVisibility="always"
                            items={view.kinds}
                            onSelect={props.on.kind}
                        />
                    </div>
                    <div className={TABS}>
                        <Tabs
                            variant="secondary"
                            label={view.deptLabel}
                            selectedKey={view.deptKey}
                            inset="none"
                            labelVisibility="always"
                            items={view.depts}
                            onSelect={props.on.dept}
                        />
                    </div>
                </div>
                <SlotView
                    slot={view.slot}
                    placeholder={view.placeholder}
                    labels={view.slotLabels}
                    onRetry={props.on.retry}
                >
                    {(list, isSkeleton) => (
                        <>
                            <Text size="xs" tone="muted">
                                {list.count}
                            </Text>
                            <SurfaceListCard
                                ariaLabel={view.listAria}
                                isLoading={isSkeleton}
                                empty={
                                    list.isFiltered ? (
                                        <EmptyNotice
                                            message={view.noMatchTitle}
                                            description={view.noMatchBody}
                                            actionLabel={view.clearFilters}
                                            actionVariant="secondary"
                                            onAction={props.on.clear}
                                        />
                                    ) : (
                                        <EmptyNotice message={view.emptyTitle} description={view.emptyBody} />
                                    )
                                }
                            >
                                {list.rows.map((row) => (
                                    <DecisionRow key={row.id} row={row} />
                                ))}
                            </SurfaceListCard>
                        </>
                    )}
                </SlotView>
            </div>
        </PageContainer>
    )
}

/** One decision and its supporting explanation and lead link. */
const DecisionRow = (props: DecisionRowProps) => {
    const { row } = props
    return (
        <>
            <ListRow
                key={row.id}
                title={row.actionLabel}
                description={`${row.departmentLabel} · ${row.decider} · ${row.when}`}
                badges={<Badge tone={row.outcomeTone}>{row.outcomeLabel}</Badge>}
            >
                {row.reason === null ? null : <Text size="sm">{row.reason}</Text>}
                {row.basis === null ? null : (
                    <Text size="sm" weight="medium">
                        {row.basis}
                    </Text>
                )}
                {row.note === null ? null : (
                    <Text size="sm" tone="muted">
                        {row.note}
                    </Text>
                )}
                {row.leadHref === null ? (
                    <Text size="xs" tone="muted">
                        {row.noLead}
                    </Text>
                ) : (
                    <TextAction href={row.leadHref} size="sm">
                        {row.leadLabel}
                    </TextAction>
                )}
            </ListRow>
        </>
    )
}

/** Inputs of the extracted list section. */
type DecisionRowProps = { readonly row: DecisionsBoardRowView }
