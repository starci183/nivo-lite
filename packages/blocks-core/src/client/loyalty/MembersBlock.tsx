import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ReadHandle } from "@nivo-lite/agent-sdk/block"
import { Avatar, Badge, ListBox, Select, Stack, SurfaceCard, Tabs, Text } from "@starci/grammar/common"
import type { ListBoxItem } from "@starci/grammar/common"
import type { loyaltyMembersBlock } from "../../blocks/loyalty/members.block"
import { cellContextOf, formatValue } from "../../rows/cell-format"
import { countedWords } from "../../rows/counted-words"
import { ALL_TAB, countsView, moreLabelOf, tabParamValue } from "../../rows/filter-tabs"
import type { TabCounts } from "../../rows/filter-tabs"
import { chosenRow, recordsView, selectionOf } from "../../rows/rows"
import {
    MEMBER_SORTS,
    MEMBER_WORD_KEYS,
    memberEntriesOf,
    memberLineOf,
    memberTabsOf,
    paramsOfTab,
    selectedMemberTab,
    sortKeyOf,
    tiersView,
} from "../../rules/loyalty/members-view"
import type { MemberEntry, MemberTier, TabParams } from "../../rules/loyalty/members-view"
import { derivedSlot, parsedSlot } from "../../slots/slots"
import { PaneSearch } from "../composites/PaneSearch"
import { LoadMore } from "../composites/SelectableRows"
import { useBlockWords, useSlotLabels } from "../composites/useBlockWords"
import type { RenderOf } from "../render-props"

type Props = RenderOf<typeof loyaltyMembersBlock>

/** The rows the list shows while the first read loads: the geometry of settled ones. */
const PLACEHOLDER_ENTRIES: ReadonlyArray<MemberEntry> = [0, 1, 2].map((index) => ({
    id: `placeholder-${index}`,
    name: "........",
    contact: "........",
    tier: "",
    points: 0,
    lastVisitAt: "",
    isAtRisk: false,
}))

/** The counts a read answers, or null while they are unknown or failed (the tabs then keep their words and show no count). */
const countsOf = (handle: ReadHandle): TabCounts | null => {
    const parsed = parsedSlot(handle.slot, countsView)
    return "items" in parsed ? parsed.items : null
}

/** The tiers of the ladder a read answers; none while it loads or failed, so only the all tab shows. */
const tiersOf = (handle: ReadHandle): ReadonlyArray<MemberTier> => {
    const parsed = parsedSlot(handle.slot, tiersView)
    return "items" in parsed ? parsed.items : []
}

/** The members of the programme as the owner reads them: a head with the sort, a search, the tier tabs and the rows. */
export const MembersBlock = (props: Props): ReactNode => {
    const host = useBlockHost()
    const words = useBlockWords()
    const word = (key: string): string => words({ key })
    const context = cellContextOf(host.locale(), undefined)
    const showAtRisk = props.props.showAtRisk !== false
    const params: TabParams = {
        tier: props.params.value(props.props.tierParam),
        activity: props.params.value(props.props.activityParam),
    }
    const choose = (tab: string): void => {
        const chosen = paramsOfTab(tab)
        props.params.setMany({ [props.props.tierParam]: chosen.tier, [props.props.activityParam]: chosen.activity })
    }
    const searched = props.params.value(props.props.searchParam)
    const labels = useSlotLabels(
        searched === null || searched === ""
            ? props.props.empty
            : (props.props.emptySearch ?? { key: "listSearchEmpty" }),
    )
    const tiers = tiersOf(props.slots.tiers)
    const tierCounts = countsOf(props.slots.tierCounts)
    const entries = derivedSlot(parsedSlot(props.slots.rows.slot, recordsView), (records) => {
        const list = memberEntriesOf(records)
        return list.length === 0 ? null : list
    })
    const moreTemplate = word("filtersMore")
    const sortOptions = MEMBER_SORTS.map((sort) => ({ id: sort, label: word(sortKeyOf(sort)) }))
    const itemOf = (entry: MemberEntry): ListBoxItem => {
        const line = memberLineOf(
            entry,
            entry.lastVisitAt === ""
                ? ""
                : countedWords(word(MEMBER_WORD_KEYS.lastPurchase), formatValue(entry.lastVisitAt, "day", context)),
        )
        return {
            id: entry.id,
            label: entry.name,
            leading: <Avatar name={entry.name} isDecorative />,
            ...(line === "" ? {} : { description: line }),
            trailing: (
                <Stack gap="inline" align="end">
                    {entry.tier === "" ? null : <Badge tone="accent">{entry.tier}</Badge>}
                    <Text size="sm" tone="muted">
                        {countedWords(word(MEMBER_WORD_KEYS.points), formatValue(entry.points, "number", context))}
                    </Text>
                    {entry.isAtRisk ? <Badge tone="warning">{word(MEMBER_WORD_KEYS.atRisk)}</Badge> : null}
                </Stack>
            ),
        }
    }
    return (
        <SurfaceCard
            label={words(props.props.label)}
            {...(tierCounts === null ? {} : { fact: formatValue(tierCounts.total, "number", context) })}
            labelEnd={
                <Select
                    label={words(props.props.sortLabel)}
                    isLabelHidden
                    appearance="pill"
                    prefix={words(props.props.sortLabel)}
                    options={sortOptions}
                    value={props.params.value(props.props.sortParam)}
                    onValueChange={(value) => props.params.set(props.props.sortParam, value)}
                />
            }
        >
            <Stack gap="row">
                <PaneSearch
                    param={props.props.searchParam}
                    params={props.params}
                    label={words(props.props.searchLabel)}
                    clearLabel={word("searchClear")}
                />
                <Tabs
                    kind="filter"
                    label={words(props.props.label)}
                    moreLabel={(count) => moreLabelOf(moreTemplate, count)}
                    overflowLabel={word("filtersOverflow")}
                    inset="none"
                    selectedKey={selectedMemberTab(params, tiers, showAtRisk)}
                    items={memberTabsOf(
                        tiers,
                        tierCounts,
                        countsOf(props.slots.activityCounts),
                        { all: words(props.props.all), atRisk: words(props.props.atRisk) },
                        showAtRisk,
                    )}
                    onSelect={(key) => choose(tabParamValue(key) ?? ALL_TAB)}
                />
                <SlotView
                    slot={entries}
                    labels={labels}
                    placeholder={PLACEHOLDER_ENTRIES}
                    onRetry={props.slots.rows.retry}
                    render={(items, isLoading) => (
                        <Stack gap="row">
                            <ListBox
                                label={words(props.props.label)}
                                items={items.map(itemOf)}
                                selectionMode="single"
                                selectionIndicator="none"
                                selectedIds={selectionOf(props.params.value(props.props.selectParam))}
                                onSelectionChange={(ids) => {
                                    const id = chosenRow(ids)
                                    if (id !== null) props.params.set(props.props.selectParam, id)
                                }}
                                isLoading={isLoading}
                            />
                            {props.slots.rows.page === null ? null : (
                                <LoadMore
                                    page={props.slots.rows.page}
                                    words={{
                                        label: words(props.props.label),
                                        loadMore: word("listLoadMore"),
                                        loadFailed: word("listLoadFailed"),
                                        retry: labels.retry,
                                    }}
                                />
                            )}
                        </Stack>
                    )}
                />
            </Stack>
        </SurfaceCard>
    )
}
