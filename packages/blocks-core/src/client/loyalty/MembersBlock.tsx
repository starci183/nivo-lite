import type { ReactNode } from "react"
import { SlotView, useBlockHost } from "@nivo-lite/agent-sdk/client"
import type { ReadHandle } from "@nivo-lite/agent-sdk/block"
import type { DataSlot, SlotLabels } from "@nivo-lite/agent-sdk/client"
import { Divider, EmptyNotice, Section, Select, Stack, SurfaceCard, Tabs } from "@starci/grammar/common"
import type { BadgeData, ListRowData } from "@starci/grammar/common"
import type { loyaltyMembersBlock } from "../../blocks/loyalty/members.block"
import { cellContextOf, formatValue } from "../../rows/cell-format"
import type { CellContext } from "../../rows/cell-format"
import { countedWords } from "../../rows/counted-words"
import { ALL_TAB, countsView, moreLabelOf, tabParamValue } from "../../rows/filter-tabs"
import type { TabCounts } from "../../rows/filter-tabs"
import { recordsView } from "../../rows/rows"
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

/** What the rows of the members take. */
interface MemberRowsProps {
    readonly blockProps: Props
    readonly entries: DataSlot<ReadonlyArray<MemberEntry>>
    readonly labels: SlotLabels
    readonly itemOf: (entry: MemberEntry) => ListRowData
    readonly word: (key: string) => string
}

/** The members as one list that writes the chosen one to the select param and loads further pages on request. */
const MemberRows = (props: MemberRowsProps): ReactNode => {
    const words = useBlockWords()
    const block = props.blockProps
    return (
        <SlotView
            slot={props.entries}
            labels={props.labels}
            placeholder={PLACEHOLDER_ENTRIES}
            onRetry={block.slots.rows.retry}
            render={(items, isLoading) => (
                <Stack gap="row">
                    <Section
                        kind="list"
                        ariaLabel={words(block.props.label)}
                        isLoading={isLoading}
                        items={items.map((entry) => ({
                            ...props.itemOf(entry),
                            onPress: () => block.params.set(block.props.selectParam, entry.id),
                        }))}
                        empty={<EmptyNotice message={props.labels.empty} />}
                    />
                    {block.slots.rows.page === null ? null : (
                        <LoadMore
                            page={block.slots.rows.page}
                            words={{
                                label: words(block.props.label),
                                loadMore: props.word("listLoadMore"),
                                loadFailed: props.word("listLoadFailed"),
                                retry: props.labels.retry,
                            }}
                        />
                    )}
                </Stack>
            )}
        />
    )
}

/** The chips of a member: the tier, and the risk of leaving; no chip is drawn for a member with neither. */
const badgesOf = (entry: MemberEntry, word: (key: string) => string): Pick<ListRowData, "badges"> => {
    const tier: BadgeData | null = entry.tier === "" ? null : { label: entry.tier, tone: "accent" }
    const risk: BadgeData | null = entry.isAtRisk ? { label: word(MEMBER_WORD_KEYS.atRisk), tone: "warning" } : null
    if (tier !== null && risk !== null) return { badges: [tier, risk] }
    const only = tier ?? risk
    return only === null ? {} : { badges: [only] }
}

/** The row the list draws for one member: the name, the last purchase, the points at the end and the tier and risk chips. */
const memberItemOf = (entry: MemberEntry, word: (key: string) => string, context: CellContext): ListRowData => {
    const line = memberLineOf(
        entry,
        entry.lastVisitAt === ""
            ? ""
            : countedWords(word(MEMBER_WORD_KEYS.lastPurchase), formatValue(entry.lastVisitAt, "day", context)),
    )
    return {
        id: entry.id,
        title: entry.name,
        leading: { avatar: { name: entry.name } },
        ...(line === "" ? {} : { description: line }),
        meta: { text: countedWords(word(MEMBER_WORD_KEYS.points), formatValue(entry.points, "number", context)) },
        ...badgesOf(entry, word),
    }
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
    const itemOf = (entry: MemberEntry): ListRowData => memberItemOf(entry, word, context)
    return (
        <SurfaceCard
            label={words(props.props.label)}
            headingLevel={3}
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
                <PaneSearch
                    param={props.props.searchParam}
                    params={props.params}
                    label={words(props.props.searchLabel)}
                    clearLabel={word("searchClear")}
                />
                <Divider />
                <MemberRows blockProps={props} entries={entries} labels={labels} itemOf={itemOf} word={word} />
            </Stack>
        </SurfaceCard>
    )
}
