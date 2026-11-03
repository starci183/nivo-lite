import {
    EmptyNotice,
    Page,
    Section,
    Stack,
    FilterButtonGroup,
    Text,
    type BadgeTone,
    type BreadcrumbItem,
    type ListRowData,
    Link,
} from "@starci/grammar/common"

import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

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

/** The historical decisions and both peer filters belong to their collection section. */
export const DecisionsBoardBase = (props: DecisionsBoardBaseProps) => {
    const view = props.props
    return (
        <Page
            measure="product"
            header={{
                breadcrumbs: { label: view.crumbLabel, items: view.crumbs },
                title: view.title,
                description: view.description,
            }}
        >
            <SlotView
                slot={view.slot}
                placeholder={view.placeholder}
                labels={view.slotLabels}
                onRetry={props.on.retry}
                render={(list, isLoading) => (
                    <Section
                        kind="list"
                        title={view.listAria}
                        meta={list.count}
                        isLoading={isLoading}
                        filter={
                            <Stack gap="row">
                                <FilterButtonGroup
                                    label={view.kindLabel}
                                    value={view.kindKey}
                                    options={view.kinds.map((kind) => ({ value: kind.id, label: kind.label }))}
                                    onValueChange={props.on.kind}
                                />
                                <FilterButtonGroup
                                    label={view.deptLabel}
                                    value={view.deptKey}
                                    options={view.depts.map((dept) => ({ value: dept.id, label: dept.label }))}
                                    onValueChange={props.on.dept}
                                />
                            </Stack>
                        }
                        items={list.rows.map(decisionItemOf)}
                        empty={
                            list.isFiltered ? (
                                <EmptyNotice
                                    message={view.noMatchTitle}
                                    description={view.noMatchBody}
                                    actionLabel={view.clearFilters}
                                    onAction={props.on.clear}
                                />
                            ) : (
                                <EmptyNotice message={view.emptyTitle} description={view.emptyBody} />
                            )
                        }
                    />
                )}
            />
        </Page>
    )
}

/** A historical decision retains all its explanations and its lead destination under the shared row. */
const decisionItemOf = (row: DecisionsBoardRowView): ListRowData => ({
    id: row.id,
    title: row.actionLabel,
    description: [row.departmentLabel, row.decider, row.when].join(" · "),
    badges: [{ label: row.outcomeLabel, tone: row.outcomeTone }],
    detail: (
        <Stack gap="row">
            {row.reason === null ? null : <Text size="sm">{row.reason}</Text>}
            {row.basis === null ? null : (
                <Text size="sm" isStrong>
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
                <Link href={row.leadHref}>{row.leadLabel}</Link>
            )}
        </Stack>
    ),
})
