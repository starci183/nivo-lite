import type { useTranslations, useFormatter } from "next-intl"
import {
    Badge,
    Button,
    Cluster,
    EmptyNotice,
    ListRow,
    SearchField,
    Stack,
    SurfaceListCard,
    Tabs,
    Text,
    TextAction,
} from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import { LeadRowMenu } from "@/components/composites/LeadRowMenu"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"
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
            >
                {(view, isSkeleton) => (
                    <>
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
                        <Tabs
                            variant="primary"
                            label={l.tabsLabel}
                            selectedKey={p.selectedTab}
                            inset="none"
                            labelVisibility="always"
                            items={view.tabs}
                            onSelect={on.select}
                        />
                        {renderLeadRows({ view, isSkeleton, l, on, p })}
                    </>
                )}
            </SlotView>
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

/** Inputs needed to build the SurfaceListCard section. */
interface RenderLeadRowsContext {
    readonly view: BoardView
    readonly isSkeleton: boolean
    readonly l: BoardLabels
    readonly on: LeadsBoardBaseProps["on"]
    readonly p: LeadsBoardBaseProps["props"]
}
/** Builds the SurfaceListCard section from the current view. */
const renderLeadRows = ({ view, isSkeleton, l, on, p }: RenderLeadRowsContext) => (
    <SurfaceListCard
        ariaLabel={view.rows.length === 0 && !isSkeleton ? l.emptyAria : l.listAria}
        isLoading={isSkeleton}
        empty={
            view.hasLeads ? (
                <EmptyNotice
                    message={l.noMatchTitle}
                    description={l.noMatchBody}
                    actionLabel={l.clearLabel}
                    actionVariant="secondary"
                    onAction={on.clear}
                />
            ) : (
                <EmptyNotice
                    message={l.emptyTitle}
                    description={l.emptyBody}
                    actionLabel={l.newLeadLabel}
                    actionVariant="secondary"
                    onAction={on.openForm}
                />
            )
        }
    >
        {view.rows.map((row) => (
            <ListRow
                key={row.id}
                leading={<PersonAvatar name={row.name} size="md" />}
                title={<TextAction href={row.href}>{row.name}</TextAction>}
                description={row.subtitle}
                badges={
                    <>
                        <Badge tone={row.stageTone} isDot>
                            {row.stageLabel}
                        </Badge>
                        <Text as="span" size="xs" tone="muted">
                            {row.ago}
                        </Text>
                    </>
                }
                actions={
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
                }
            >
                <Text size="xs" tone="muted" overflow="truncate">
                    {row.who}
                </Text>
                {row.actionError === null ? null : (
                    <Text size="xs" live="polite">
                        {row.actionError}
                    </Text>
                )}
            </ListRow>
        ))}
    </SurfaceListCard>
)

/** Formatting context for a lead capture timestamp. */
export interface LeadAgeContext {
    readonly nowIso: string
    readonly t: ReturnType<typeof useTranslations<"leads">>
    readonly format: ReturnType<typeof useFormatter>
}
