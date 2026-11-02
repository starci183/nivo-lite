import type { useTranslations, useFormatter } from "next-intl"
import {
    Button,
    Cluster,
    EmptyNotice,
    FilterButtonGroup,
    SearchField,
    Stack,
    Section,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { LeadRowMenu } from "@/components/composites/LeadRowMenu"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { SEARCH_CLASS_NAME } from "./classNames"

/** One lead of the list, every word already resolved. */
export interface LeadRowView {
    readonly id: string
    readonly name: string
    readonly href: string
    readonly ago: string
    readonly subtitle: string
    readonly who: string
    readonly stageLabel: string
    readonly stageTone: BadgeTone
    /** True when the lead has no owner yet, so the menu offers to propose one. */
    readonly canPropose: boolean
    /** The words of a failed row command (proposing an owner); null while none failed. */
    readonly actionError: string | null
}

/** What the board shows: the tabs with their counts and the rows the filters let through. */
export interface BoardView {
    readonly tabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly rows: ReadonlyArray<LeadRowView>
    readonly hasLeads: boolean
    readonly isFiltered: boolean
}

/** The words of the board. */
export interface BoardLabels {
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearLabel: string
    readonly tabsLabel: string
    readonly newLeadLabel: string
    readonly listAria: string
    readonly emptyAria: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly openLabel: string
    readonly officeLabel: string
    readonly officeHref: string
    readonly proposeLabel: string
    readonly moreLabel: string
    /** The tabs while the leads load: real names, no counts. */
    readonly loadingTabs: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly slot: SlotLabels
}

/** The words and data of the Leads list. */
export interface LeadsBoardBaseProps {
    readonly props: {
        readonly slot: DataSlot<BoardView>
        readonly labels: BoardLabels
        readonly query: string
        readonly selectedTab: string
        readonly isRowBusy: boolean
        readonly pagination: {
            readonly hasNextPage: boolean
            /** True while the next page is on its way. */
            readonly isPending: boolean
            readonly loadMoreError: string | null
            readonly loadedHint: string | null
            readonly loadMoreLabel: string
            readonly retryLabel: string
        }
    }
    readonly on: {
        readonly query: (value: string) => void
        readonly clear: () => void
        readonly select: (tab: string) => void
        readonly openForm: () => void
        readonly propose: (leadId: string) => void
        readonly loadMore: () => void
        readonly retry: () => void
    }
}

const PLACEHOLDER: BoardView = { tabs: [], rows: [], hasLeads: true, isFiltered: false }

/** The Leads list: search, stage tabs and the lead rows, each with its owner, stage and next action. */
export const LeadsBoardBase = (props: LeadsBoardBaseProps) => {
    const { props: p, on } = props
    const l = p.labels
    return (
        <Stack gap="region">
            <SlotView
                slot={p.slot}
                placeholder={{ ...PLACEHOLDER, tabs: l.loadingTabs }}
                labels={l.slot}
                onRetry={on.retry}
                render={(view, isSkeleton) => renderLeadRows({ view, isSkeleton, l, on, p })}
            />
            {p.pagination.loadedHint === null ? null : (
                <Text size="sm" tone="muted">
                    {p.pagination.loadedHint}
                </Text>
            )}
            {p.pagination.loadMoreError === null ? null : (
                <Text size="sm" live="polite">
                    {p.pagination.loadMoreError}
                </Text>
            )}
            {p.pagination.hasNextPage || p.pagination.loadMoreError !== null ? (
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={p.pagination.isPending}
                    isDisabled={p.pagination.isPending}
                    onPress={p.pagination.loadMoreError === null ? on.loadMore : on.retry}
                >
                    {p.pagination.loadMoreError === null ? p.pagination.loadMoreLabel : p.pagination.retryLabel}
                </Button>
            ) : null}
        </Stack>
    )
}

/** Inputs needed to build the searchable lead section. */
interface RenderLeadRowsContext {
    readonly view: BoardView
    readonly isSkeleton: boolean
    readonly l: BoardLabels
    readonly on: LeadsBoardBaseProps["on"]
    readonly p: LeadsBoardBaseProps["props"]
}
/** Keeps the search, stage filters and typed lead rows under one collection owner. */
const renderLeadRows = ({ view, isSkeleton, l, on, p }: RenderLeadRowsContext) => (
    <Section
        kind="list"
        title={view.rows.length === 0 && !isSkeleton ? l.emptyAria : l.listAria}
        isLoading={isSkeleton}
        filter={
            <Stack gap="row">
                <Cluster gap="section" align="end">
                    <div className={SEARCH_CLASS_NAME}>
                        <SearchField
                            label={l.searchLabel}
                            placeholder={l.searchPlaceholder}
                            value={p.query}
                            onValueChange={on.query}
                            onClear={on.clear}
                        />
                    </div>
                    {view.isFiltered ? <TextAction onPress={on.clear}>{l.clearLabel}</TextAction> : null}
                </Cluster>
                <FilterButtonGroup
                    label={l.tabsLabel}
                    value={p.selectedTab}
                    onValueChange={on.select}
                    options={view.tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
                />
            </Stack>
        }
        empty={
            view.hasLeads ? (
                <EmptyNotice
                    message={l.noMatchTitle}
                    description={l.noMatchBody}
                    actionLabel={l.clearLabel}
                    onAction={on.clear}
                />
            ) : (
                <EmptyNotice
                    message={l.emptyTitle}
                    description={l.emptyBody}
                    actionLabel={l.newLeadLabel}
                    onAction={on.openForm}
                />
            )
        }
        items={view.rows.map((row) => ({
            id: row.id,
            leading: { avatar: { name: row.name } },
            title: row.name,
            description: [row.subtitle, row.ago].filter((part) => part !== "").join(" · "),
            badges: [{ label: row.stageLabel, tone: row.stageTone, isDot: true }],
            action: { label: l.openLabel, href: row.href, intent: "neutral" },
            detail: (
                <Stack gap="identity">
                    <LeadRowMenu
                        leadId={row.id}
                        href={row.href}
                        officeHref={l.officeHref}
                        canPropose={row.canPropose}
                        isDisabled={p.isRowBusy}
                        openLabel={l.openLabel}
                        officeLabel={l.officeLabel}
                        proposeLabel={l.proposeLabel}
                        moreLabel={l.moreLabel}
                        onPropose={on.propose}
                    />
                    <Text size="xs" tone="muted" overflow="truncate">
                        {row.who}
                    </Text>
                    {row.actionError === null ? null : (
                        <Text size="xs" live="polite">
                            {row.actionError}
                        </Text>
                    )}
                </Stack>
            ),
        }))}
    />
)

/** Formatting context for a lead capture timestamp. */
export interface LeadAgeContext {
    readonly nowIso: string
    readonly t: ReturnType<typeof useTranslations<"leads">>
    readonly format: ReturnType<typeof useFormatter>
}
